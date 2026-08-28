# Supabase Edge Functions — Stripe

Tre funktioner under `functions/`. Ingen af dem er kørt eller deployet endnu.

- [DEPLOY.md](DEPLOY.md) — kommandoer til at oprette, deploye og kalde funktioner
- [RLS.md](RLS.md) — row level security-policies for alle tabeller

| Funktion              | Auth            | Formål                                                        |
| --------------------- | --------------- | ------------------------------------------------------------- |
| `create-checkout`     | `user`          | Checkout Session: abonnement + 99 kr. oprettelsesgebyr        |
| `stripe-webhook`      | `none`          | Aktiverer abonnement, gemmer betalinger, beregner ekstra ejendele |
| `manage-subscription` | `user`          | Opsig, genoptag, kundeportal (betalingsmetode)                |

## 1. Init (CLI er ikke installeret endnu)

```bash
brew install supabase/tap/supabase
supabase init                 # opretter config.toml
supabase link --project-ref ufpuznbsdxwzdkjbkgbu
```

`supabase init` overskriver ikke `functions/`.

## 2. config.toml

Webhooken skal undtages fra JWT-kontrol — Stripe sender ingen Supabase-JWT.
Uden denne blok afvises alle Stripe-kald med 401:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

## 3. Secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_PRIVAT=price_... \
  STRIPE_PRICE_ERHVERV=price_... \
  STRIPE_PRICE_SETUP=price_... \
  SITE_URL=https://ejendelsregisteret.dk
```

`SUPABASE_URL` og service role-nøglen injiceres automatisk i runtime — sæt dem ikke selv.

Priserne oprettes i Stripe først: to recurring priser (privat/erhverv) og én
one-time pris på 99 kr. **Beløbene står bevidst ikke i koden** — klienten
sender kun `planId`, og funktionen slår price-id'et op i env. Kommer prisen
fra klienten, kan den ændres i devtools inden checkout oprettes.

### Faktureringsfrekvens

Frekvensen findes **ikke i koden** — den er en egenskab på de to recurring
Price-objekter i Stripe (`recurring.interval`). Koden kender kun price-id'et.
Opret begge som `interval: month`, ellers passer databasen ikke:

- `subscriptions.monthly_price` fyldes af `monthlyPriceOf()` i stripe-webhook,
  som blot læser `unit_amount` på den recurring linje. Er prisen årlig, står
  årsbeløbet i en kolonne der hedder `monthly_price`.
- `billing_usage.billing_month` udledes af `invoice.period_end` og antager én
  række pr. måned. Med årlig fakturering beregnes ekstra ejendele kun én gang
  om året, ud fra antallet den dag fornyelsen falder.
- `lib/plans.ts` viser `29 kr./md.` og `149 kr./md.` som ren tekst. Den værdi
  sendes aldrig til Stripe og opdager derfor ikke en uoverensstemmelse.

Ekstra ejendele beregnes kun ved fornyelser (`billing_reason ===
"subscription_cycle"`), ikke på første faktura, og opkræves **forud**: antallet
tælles når fakturaen oprettes, og lægges på fakturaen for den kommende periode.

### Daglige abonnementer til test

At vente en måned på en fornyelse er ikke en testcyklus. To muligheder:

**A. Stripe test clocks (anbefalet).** Behold `interval: month` og spol tiden
frem. Ingen kodeændringer, og du tester præcis den opsætning der går i drift:

```bash
stripe billing test-clocks create --frozen-time $(date +%s)
# opret kunden med --test-clock <id>, kør checkout, og spol så frem:
stripe billing test-clocks advance <id> --frozen-time <ts + 31 dage>
```

**B. Daglig pris.** Hurtigere at sætte op, men kræver én kodeændring:

```bash
stripe prices create \
  --unit-amount 2900 --currency dkk \
  --recurring.interval day \
  --product <product_id>
```

Sæt det nye price-id i `STRIPE_PRICE_PRIVAT` og deploy funktionerne igen.

**Ændringen der skal med:** `onInvoiceCreated` nøgler idempotensen på
kalendermåneden. Med daglige fornyelser får dag 1 og dag 2 samme nøgle, så
tjekket rammer fra dag 2 og ekstra ejendele faktureres aldrig igen. Det fejler
stille — ingen fejl i loggen, bare et tidligt `return`.

Skift nøglen til fakturaen. Stripe sender ét `invoice.created` pr. faktura,
så det virker uanset interval — også når du skifter tilbage til månedlig:

```ts
// FØR — bundet til én fornyelse pr. kalendermåned
const billingMonth = new Date(invoice.period_end * 1000)
  .toISOString()
  .slice(0, 8) + "01";

const { data: alreadyBilled } = await admin
  .from("billing_usage")
  .select("id")
  .eq("user_id", sub.user_id)
  .eq("billing_month", billingMonth)
  .maybeSingle();
```

```ts
// EFTER — frekvensuafhængig
// Fuld dato, så hver fornyelse får sin egen række uanset interval.
const billingMonth = new Date(invoice.period_end * 1000)
  .toISOString()
  .slice(0, 10);

// Fakturaen er den naturlige nøgle: én pr. faktureringsperiode.
const { data: alreadyBilled } = await admin
  .from("billing_usage")
  .select("id")
  .eq("stripe_invoice_id", invoice.id)
  .maybeSingle();
```

Resten af funktionen er uændret — `billing_month` indsættes stadig, blot som
en rigtig dato frem for altid den 1.

Databasen skal følge med. Det unikke index i [RLS.md](RLS.md) flyttes fra
`(user_id, billing_month)` til fakturaen, ellers afviser den daglige rækker
i samme måned:

```sql
drop index if exists billing_usage_user_month_key;

create unique index if not exists billing_usage_stripe_invoice_id_key
  on public.billing_usage (stripe_invoice_id);
```

Bemærk til sidst at `subscriptions.monthly_price` så indeholder dagsprisen.
Kolonnenavnet lyver under test — det er kosmetisk, men husk det når du læser
data igennem bagefter.

## 4. Deploy

```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
supabase functions deploy manage-subscription
```

## 5. Stripe-webhook endpoint

Peg Stripe mod:

```
https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/stripe-webhook
```

Events der skal abonneres på:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created` ← nødvendig for ekstra ejendele
- `invoice.paid`
- `invoice.payment_failed`

## 6. Test lokalt

```bash
supabase functions serve
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Kald fra frontenden

```ts
const { data, error } = await supabase.functions.invoke("create-checkout", {
  body: { planId: "privat" },
});
if (data?.url) window.location.href = data.url;
```

`functions.invoke` sender brugerens JWT med automatisk, så `auth: "user"` går igennem.

## Forudsætninger i databasen

- **RLS** skal være slået til på alle tabeller. Færdige policies med SQL ligger
  i [RLS.md](RLS.md) — kør dem inden funktionerne deployes.
  `create-checkout` og `manage-subscription` læser gennem den RLS-scopede
  klient netop for at brugeren ikke kan røre andres rækker.
- **Data API-adgang**: nye tabeller eksponeres ikke længere automatisk
  (Supabase-ændring 28-04-2026). Får du "relation does not exist" fra
  frontenden, mangler `anon`/`authenticated` et eksplicit `GRANT`.
- `subscriptions.user_id` skal have en UNIQUE-constraint — `create-checkout`
  bruger `upsert(..., { onConflict: "user_id" })`. Den er dokumenteret i
  `database/database.md`, men bekræft at den faktisk findes.
