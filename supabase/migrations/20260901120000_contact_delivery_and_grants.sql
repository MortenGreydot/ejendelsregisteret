-- To ting der begge kom af at kontakt-funktionerne blev bygget efter RLS'en.

-- ---------------------------------------------------------------------
-- 1. Spor på om henvendelsen faktisk nåede ejeren
-- ---------------------------------------------------------------------
--
-- contact-owner kunne kvittere med "din besked er sendt" til finderen, selv
-- når ejerens mail aldrig kom afsted. Fejlen stod kun i et console.error,
-- og en log ingen læser er ikke et spor.
--
-- Vi er mellemled. Går videresendelsen galt, skal vi kunne finde de
-- henvendelser der mangler at blive givet videre i hånden — og det kan vi
-- kun hvis udfaldet står på rækken.

alter table public.contact_requests
  add column if not exists delivered_at   timestamptz,
  add column if not exists delivery_error text;

comment on column public.contact_requests.delivered_at is
  'Tidspunkt hvor ejerens mail kom afsted. NULL = ikke videresendt.';
comment on column public.contact_requests.delivery_error is
  'Hvorfor videresendelsen fejlede. Sat sammen med delivered_at = NULL.';

create index if not exists contact_requests_ikke_leveret
  on public.contact_requests (created_at desc)
  where delivered_at is null;

-- ---------------------------------------------------------------------
-- 2. Gentag revoke'et fra 20260824064150 på de nye tabeller
-- ---------------------------------------------------------------------
--
-- Den migration nulstillede grants med `revoke all on all tables`, men den
-- ramte kun de tabeller der fandtes dengang. Fire tabeller er kommet til
-- siden, og de har alle fået Supabases standardrettigheder tilbage —
-- inklusive TRUNCATE, som RLS ikke dækker. En policy stopper ikke en
-- TRUNCATE; kun et manglende grant gør.
--
-- Begrundelsen er ordret den samme som i sektion 0 dengang, og gælder lige
-- så meget her: uden det her kan rettighederne rulle tilbage ved hver ny
-- tabel man laver.

revoke all on public.contact_requests   from anon, authenticated;
revoke all on public.contact_rate_limit from anon, authenticated;
revoke all on public.email_log          from anon, authenticated;
revoke all on public.item_serials       from anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;

-- item_serials er den eneste af de fire brugeren selv rører: serienumre
-- oprettes fra Min side gennem PostgREST. De fire rettigheder her er dem
-- 20260824140000 gav — TRUNCATE, REFERENCES og TRIGGER er ikke iblandt.
grant select, insert, update, delete on public.item_serials to authenticated;

-- contact_requests, contact_rate_limit og email_log får bevidst intet.
-- Kun service role og de security definer-funktioner rører dem.
