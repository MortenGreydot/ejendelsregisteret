-- Påmindelse til den der gik til Stripe og ikke blev færdig.
--
-- ── Hvorfor betingelserne ser ud som de gør ──────────────────────────
--
-- pending_activation er IKKE et tegn på at nogen har fortrudt. Statussen
-- sættes af create-checkout på vejen til Stripe, altså før brugeren
-- overhovedet har set betalingsvinduet. Alle får den — også dem der
-- betaler et øjeblik senere. Først når webhooken modtager
-- checkout.session.completed hæves den til active.
--
-- Sender vi på status alene, rammer mailen derfor enhver ny kunde,
-- inklusive dem der lige har betalt. Derfor tre spærringer:
--
--   1. status = 'pending_activation' NU, ikke da rækken blev skrevet.
--      Er betalingen gået igennem i mellemtiden, står den som active og
--      rækken kommer ikke med.
--   2. updated_at ældre end en time. create-checkout sætter updated_at
--      ved hvert forsøg, så uret nulstilles hvis kunden prøver igen. Det
--      giver også webhooken rigelig tid: den lander normalt på sekunder,
--      men Stripe genudsender ved fejl, og en forsinket levering må ikke
--      koste kunden en forkert mail.
--   3. Ikke sendt før. Står i email_log, som send-email fører med en
--      UNIQUE(user_id, kind).
--   4. Højst syv dage gammel. To grunde: en påmindelse om en betaling man
--      opgav for en måned siden er ikke et puf, det er en underlig mail.
--      Og uden loftet ville jobbet ved første kørsel sende til hele den
--      ophobede bunke af gamle afbrudte forsøg på én gang.
--
-- Den der aldrig nåede til Stripe har slet ingen abonnementsrække — de
-- får "Din konto er oprettet" med knappen til priserne i stedet, og
-- rammes ikke af denne her.

create or replace function public.nudge_afbrudt_betaling()
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
    where s.status = 'pending_activation'
      and s.updated_at < now() - interval '1 hour'
      and s.updated_at > now() - interval '7 days'
      and not exists (
        select 1 from public.email_log e
        where e.user_id = s.user_id
          and e.kind = 'betaling_ikke_fuldfoert'
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
        'kind', 'betaling_ikke_fuldfoert',
        'user_id', bruger.user_id
      ),
      timeout_milliseconds := 10000
    );

    antal := antal + 1;
  end loop;

  return antal;
end;
$$;

revoke execute on function public.nudge_afbrudt_betaling() from public, anon, authenticated;

-- Hver time, forskudt fra nudge-uden-ejendele så de to jobs ikke fyrer
-- http-kald i samme sekund.
select cron.schedule(
  'nudge-afbrudt-betaling',
  '45 * * * *',
  $job$ select public.nudge_afbrudt_betaling(); $job$
);

-- Nyttige forespørgsler:
--   -- hvem ville få mailen lige nu?
--   select s.user_id, s.updated_at
--   from public.subscriptions s
--   where s.status = 'pending_activation'
--     and s.updated_at < now() - interval '1 hour'
--     and s.updated_at > now() - interval '7 days'
--     and not exists (select 1 from public.email_log e
--                     where e.user_id = s.user_id
--                       and e.kind = 'betaling_ikke_fuldfoert');
--
--   select public.nudge_afbrudt_betaling();
--   select cron.unschedule('nudge-afbrudt-betaling');
