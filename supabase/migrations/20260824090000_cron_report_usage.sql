-- Dagligt cron-job der kalder report-usage.
--
-- Uden dette job når der aldrig et meter event frem til Stripe, og alle
-- kunder faktureres flat uanset hvor mange ejendele de har.
--
-- Tokenet ligger i Vault, ikke i denne fil og ikke i cron.job. Se noten
-- nederst — Vault-hemmeligheden skal oprettes separat, ellers sender
-- jobbet en tom header og funktionen svarer 401.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- cron.schedule opdaterer et eksisterende job med samme navn, så
-- migrationen kan køres igen uden at der opstår dubletter.
select cron.schedule(
  'report-usage-daily',
  '0 3 * * *',
  $job$
  select net.http_post(
    url := 'https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/report-usage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cron_secret'
      )
    ),
    timeout_milliseconds := 30000
  );
  $job$
);

-- Kører 03:00 UTC. report-usage behandler kun abonnementer hvis periode
-- udløber inden for det næste døgn, så det er uden betydning hvilket
-- tidspunkt på døgnet der vælges — blot det kører dagligt.
--
-- Nyttige forespørgsler:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('report-usage-daily');
