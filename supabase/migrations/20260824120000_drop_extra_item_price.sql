-- Fjerner subscriptions.extra_item_price.
--
-- Med graduated tiered pricing ejer Stripe både fribundgrænsen og satsen:
--
--   tier 1   ejendel 1–5    0 kr./stk. + 29 kr. fast
--   tier 2   ejendel 6+     2 kr./stk.
--
-- Kolonnen blev ikke læst af nogen kode. At lade den stå ville se ud som om
-- den styrede prisen, så en ændring af tallet ville kun skabe uenighed
-- mellem databasen og kundens faktura.

alter table public.subscriptions drop column if exists extra_item_price;
