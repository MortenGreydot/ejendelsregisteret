-- Bevarer regnskabsmateriale når en bruger sletter sin konto.
--
-- Bogføringsloven kræver at regnskabsmateriale opbevares i 5 år. payments og
-- billing_usage havde ON DELETE CASCADE mod auth.users, så en kontosletning
-- ville fjerne betalingshistorikken sammen med brugeren.
--
-- Løsningen er SET NULL frem for CASCADE: transaktionen består, men den
-- personhenførbare reference fjernes. Det opfylder både opbevaringspligten
-- og retten til sletning — beløb, datoer og Stripe-referencer er ikke
-- personoplysninger i sig selv.
--
-- Identiteten bag en bevaret række findes i Stripe via stripe_invoice_id og
-- stripe_customer_id. Derfor tilføjes kundenummeret her: uden det ville
-- rækken efter sletningen ikke kunne henføres til noget som helst, og så
-- ville den være ubrugelig som regnskabsmateriale.

alter table public.payments      alter column user_id drop not null;
alter table public.billing_usage alter column user_id drop not null;

alter table public.payments      drop constraint payments_user_id_fkey;
alter table public.billing_usage drop constraint billing_usage_user_id_fkey;

alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.billing_usage
  add constraint billing_usage_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.payments
  add column if not exists stripe_customer_id text;

-- RLS-policyerne matcher user_id mod auth.uid(). En række med user_id = null
-- matcher ingen, så bevarede rækker er usynlige for alle brugere. Det er
-- tilsigtet: de findes af hensyn til bogføringen, ikke til visning.
