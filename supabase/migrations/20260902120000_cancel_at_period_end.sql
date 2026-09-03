-- Er medlemskabet opsagt, men stadig løbende?
--
-- Opsigelse sker ved periodens udløb, ikke straks — kunden har betalt for
-- perioden. Stripe holder derfor status på `active` og markerer i stedet
-- abonnementet med cancel_at_period_end, helt frem til den dag det stopper.
--
-- Den markering fandtes ikke i vores database. Konsekvensen var at Min side
-- så præcis ud som før opsigelsen: samme "Opsig abonnement"-knap, ingen
-- besked om at medlemskabet stopper, og ingen vej tilbage. Trykkede man
-- igen, blev opsigelsen sat på ny og der røg endnu en opsigelsesmail
-- afsted. Mailens knap "Fortryd opsigelsen" pegede på en side der ikke
-- kunne fortryde noget.
--
-- Kolonnen skrives to steder: af manage-subscription når kunden selv
-- opsiger eller genoptager, og af webhooken ved customer.subscription.*,
-- så en ændring foretaget i Stripes egen kundeportal også fanges.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.subscriptions.cancel_at_period_end is
  'True = opsagt, men løber til current_period_end. Status er stadig active indtil da.';

-- Ingen backfill: der er i skrivende stund ingen abonnementer med en
-- verserende opsigelse. Skulle der komme en ud af trit, retter det næste
-- customer.subscription.updated-event den af sig selv.
