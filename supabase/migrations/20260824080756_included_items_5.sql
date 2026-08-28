-- Fribundgrænsen ændres fra 25 til 5 inkluderede ejendele.
--
-- Defaulten står to steder, og begge skal følges ad: subscriptions sætter
-- grænsen for den enkelte kunde, og billing_usage gemmer den grænse der
-- faktisk blev regnet med i en given måned.
--
-- report-usage læser subscriptions.included_items og trækker den fra, før
-- forbruget rapporteres til Stripes meter. Prisen er per_unit uden tiers,
-- så Stripe kender ikke grænsen — den findes kun her og i koden.

alter table public.subscriptions alter column included_items set default 5;
alter table public.billing_usage  alter column included_items set default 5;

-- Eksisterende abonnementer flyttes med. Tabellen er tom nu, men sætningen
-- gør migrationen korrekt hvis den senere køres på et miljø med data.
update public.subscriptions set included_items = 5 where included_items = 25;
