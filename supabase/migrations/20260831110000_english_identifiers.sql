-- Omdøber de danske identifikatorer i mailfunktionerne til engelsk.
--
-- Kun navne ændrer sig — adfærd, triggere og tidsplan er de samme. De
-- gamle migrationer røres ikke: de er kørt, og en migration er en
-- historisk optegnelse over hvad der faktisk skete, ikke en fil man
-- redigerer bagefter.
--
-- Værdierne i `kind` ('foerste_ejendel', 'graense_naaet', ...) bliver
-- stående på dansk. De er data i email_log og i edge-funktionens payload,
-- ikke variabelnavne — omdøbes de, matcher de eksisterende rækker ikke
-- længere, og engangsmails ville blive sendt igen.

-- ---------------------------------------------------------------------
-- notify_item_created — funktionsnavnet var allerede engelsk, variablerne
-- ikke: antal → item_count, inkluderet → included_items, besked → mail_kind
-- ---------------------------------------------------------------------

create or replace function public.notify_item_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_count     integer;  -- antal
  included_items integer;  -- inkluderet i abonnementet
  mail_kind      text;     -- besked-typen der sendes
begin
  select count(*) into item_count
    from public.items where user_id = new.user_id;

  select s.included_items into included_items
    from public.subscriptions s where s.user_id = new.user_id;

  included_items := coalesce(included_items, 5);

  -- Kun to øjeblikke er værd at skrive om: den allerførste ejendel, og den
  -- der fylder kvoten op. Alt derimellem ville være støj.
  if item_count = 1 then
    mail_kind := 'foerste_ejendel';
  elsif item_count = included_items then
    mail_kind := 'graense_naaet';
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
    body := jsonb_build_object('kind', mail_kind, 'user_id', new.user_id),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke execute on function public.notify_item_created() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- nudge_uden_ejendele → nudge_users_without_items
-- ("puf til brugere uden ejendele")
-- ---------------------------------------------------------------------

create or replace function public.nudge_users_without_items()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sent_count integer := 0;  -- antal puf sendt i denne kørsel
  target     record;        -- brugeren der skal puffes
begin
  for target in
    select s.user_id
    from public.subscriptions s
    where s.status = 'active'
      and s.created_at < now() - interval '24 hours'
      and not exists (
        select 1 from public.items i where i.user_id = s.user_id
      )
      and not exists (
        select 1 from public.email_log e
        where e.user_id = s.user_id
          and e.kind = 'ingen_ejendel_endnu'
      )
  loop
    perform net.http_post(
      url := 'https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/send-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cron_secret'
        )
      ),
      body := jsonb_build_object(
        'kind', 'ingen_ejendel_endnu',
        'user_id', target.user_id
      ),
      timeout_milliseconds := 10000
    );

    sent_count := sent_count + 1;
  end loop;

  return sent_count;
end;
$$;

revoke execute on function public.nudge_users_without_items() from public, anon, authenticated;

-- Jobbet skal pege på det nye navn. Det gamle job afmeldes først —
-- cron.schedule opdaterer kun et job med samme jobname, så uden dette
-- ville begge stå tilbage og det gamle kalde en funktion der er væk.
select cron.unschedule('nudge-uden-ejendele')
where exists (select 1 from cron.job where jobname = 'nudge-uden-ejendele');

select cron.schedule(
  'nudge-users-without-items',
  '15 * * * *',
  $job$ select public.nudge_users_without_items(); $job$
);

drop function if exists public.nudge_uden_ejendele();
