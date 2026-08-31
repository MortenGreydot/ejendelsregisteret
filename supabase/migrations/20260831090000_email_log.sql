-- Register over sendte mails.
--
-- Flere af mailene må kun sendes én gang: velkomst, "din første ejendel",
-- "du har nået grænsen", påmindelsen efter 24 timer. Uden et register ville
-- natjobbet sende påmindelsen hver eneste nat til den samme bruger.
--
-- Kvitteringer registreres IKKE her — de skal sendes hver måned, og de har
-- fakturaen i Stripe som deres eget spor.

create table if not exists public.email_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users(id) on delete set null,
  kind      text not null,
  sent_at   timestamptz not null default now(),
  -- Én mail af hver slags pr. bruger. Er rækken der, er mailen sendt.
  unique (user_id, kind)
);

alter table public.email_log enable row level security;

-- Ingen policies: kun service role (som omgår RLS) skriver og læser her.
-- Brugeren har intet at bruge sin egen mail-historik til, og listen røber
-- hvornår vi kontakter folk.

-- ---------------------------------------------------------------------
-- Udløsere fra databasen
-- ---------------------------------------------------------------------
--
-- Ejendele oprettes direkte fra klienten via PostgREST, ikke gennem en edge
-- function. Derfor kan mails ved oprettelse ikke sendes fra appkoden — en
-- bruger der lukker fanen ville aldrig få dem. Triggeren kalder i stedet
-- send-email over HTTP med pg_net, ligesom cron-jobbet gør.

create or replace function public.notify_item_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antal      integer;
  inkluderet integer;
  besked     text;
begin
  select count(*) into antal
    from public.items where user_id = new.user_id;

  select included_items into inkluderet
    from public.subscriptions where user_id = new.user_id;

  inkluderet := coalesce(inkluderet, 5);

  -- Kun to øjeblikke er værd at skrive om: den allerførste ejendel, og den
  -- der fylder kvoten op. Alt derimellem ville være støj.
  if antal = 1 then
    besked := 'foerste_ejendel';
  elsif antal = inkluderet then
    besked := 'graense_naaet';
  else
    return new;
  end if;

  perform net.http_post(
    url := 'https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret'
      )
    ),
    body := jsonb_build_object('kind', besked, 'user_id', new.user_id),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke execute on function public.notify_item_created() from public, anon, authenticated;

drop trigger if exists on_item_created on public.items;

create trigger on_item_created
after insert on public.items
for each row execute function public.notify_item_created();
