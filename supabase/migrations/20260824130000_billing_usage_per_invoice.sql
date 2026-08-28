-- billing_usage: én række pr. faktura i stedet for pr. kalendermåned.
--
-- Tabellen havde UNIQUE (user_id, billing_month), og webhooken skriver med
-- upsert. To fakturaer i samme kalendermåned overskrev derfor hinanden i
-- stilhed — hvilket allerede var sket: en proration-faktura og en almindelig
-- fornyelse kan sagtens falde i samme måned.
--
-- En række svarer i virkeligheden til én faktura, så det er fakturaens id
-- der skal være nøglen.

alter table public.billing_usage
  add column if not exists period_start timestamptz,
  add column if not exists period_end   timestamptz;

comment on column public.billing_usage.period_start is
  'Faktureringsperiodens start, aflæst af fakturalinjen. billing_month er en afkortet dato og taber den faktiske periode.';

-- Fakturaens id er nu nøglen og skal derfor altid være udfyldt.
-- Alle eksisterende rækker har en værdi.
alter table public.billing_usage
  alter column stripe_invoice_id set not null;

alter table public.billing_usage
  drop constraint if exists billing_usage_user_month_unique;

alter table public.billing_usage
  add constraint billing_usage_invoice_unique unique (stripe_invoice_id);

-- billing_month bevares som praktisk grupperingsfelt til rapporter.
-- Den afgør bare ikke længere entydighed.
create index if not exists billing_usage_user_month_idx
  on public.billing_usage (user_id, billing_month);
