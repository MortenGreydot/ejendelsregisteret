-- Mails der ikke udløses af Stripe: velkomst ved oprettelse, og et puf
-- til aktive medlemmer der ikke har registreret noget efter et døgn.
--
-- Begge går gennem edge-funktionen send-email, som slår adressen op og
-- fører email_log. Databasen sender ikke selv mail — den beslutter kun
-- hvornår der skal sendes.

-- ---------------------------------------------------------------------
-- 1. "Din konto er oprettet"
-- ---------------------------------------------------------------------
--
-- Sendes når mailadressen er bekræftet, ikke når rækken oprettes. Er
-- bekræftelse slået til, findes brugeren i auth.users længe før de har
-- bevist at adressen er deres — og så ville velkomstmailen lande hos den
-- der fik adressen tastet forkert.
--
-- Er bekræftelse slået fra, er email_confirmed_at sat allerede ved insert.
-- Derfor to triggere: én på insert, én på update. send-email afviser den
-- anden via UNIQUE(user_id, kind) i email_log, så de kan ikke overlappe.

create or replace function public.notify_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    body := jsonb_build_object('kind', 'oprettet', 'user_id', new.id),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke execute on function public.notify_user_confirmed() from public, anon, authenticated;

drop trigger if exists on_auth_user_confirmed_insert on auth.users;

create trigger on_auth_user_confirmed_insert
after insert on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.notify_user_confirmed();

drop trigger if exists on_auth_user_confirmed on auth.users;

-- when-klausulen er afgørende: uden den fyrer triggeren ved hvert eneste
-- login, fordi auth.users opdateres med last_sign_in_at.
create trigger on_auth_user_confirmed
after update on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.notify_user_confirmed();


-- ---------------------------------------------------------------------
-- 2. "Du har ikke registreret noget endnu"
-- ---------------------------------------------------------------------
--
-- Et aktivt medlemskab uden en eneste ejendel er en kunde der betaler for
-- noget de ikke bruger. De opsiger som regel ved næste træk, medmindre de
-- får det gjort. Derfor et puf efter et døgn.
--
-- Kriterierne: aktivt abonnement, oprettet for mere end 24 timer siden,
-- nul ejendele, og ikke puffet før. Den sidste betingelse ligger både her
-- og i send-email — her for ikke at spilde HTTP-kald, dér som den
-- egentlige garanti, da UNIQUE-constrainten er det eneste der holder ved
-- samtidige kald.

create or replace function public.nudge_uden_ejendele()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  antal integer := 0;
  bruger record;
begin
  for bruger in
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
        'user_id', bruger.user_id
      ),
      timeout_milliseconds := 10000
    );

    antal := antal + 1;
  end loop;

  return antal;
end;
$$;

revoke execute on function public.nudge_uden_ejendele() from public, anon, authenticated;

-- Hver time, ikke hver nat. Et døgn efter betalingen er pointen — og
-- rammer jobbet kun én gang i døgnet, bliver "24 timer" i praksis til
-- alt mellem 24 og 48.
select cron.schedule(
  'nudge-uden-ejendele',
  '15 * * * *',
  $job$ select public.nudge_uden_ejendele(); $job$
);

-- Nyttige forespørgsler:
--   select * from cron.job;
--   select public.nudge_uden_ejendele();
--   select cron.unschedule('nudge-uden-ejendele');
