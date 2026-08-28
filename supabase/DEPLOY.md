# Deploy af edge functions — hurtig guide

Kommandoer til at få funktionerne op. Project ref: `ufpuznbsdxwzdkjbkgbu`.

## Engangsopsætning

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref ufpuznbsdxwzdkjbkgbu
```

`supabase link` gemmer project ref lokalt, så `--project-ref` kan udelades
bagefter. Det er taget med nedenfor alligevel, så kommandoerne virker uanset.

## Ny funktion

```bash
supabase functions new min-funktion
```

Scaffoldet bruger `Deno.serve(...)`. De tre eksisterende funktioner her bruger
i stedet `withSupabase` fra `npm:@supabase/server`, som selv håndterer auth og
klient-opsætning — kopier mønstret fra `create-checkout/index.ts` frem for at
starte fra scaffoldet.

## Secrets FØR deploy

Funktionerne kalder `requireEnv()` ved opstart og crasher hvis en variabel
mangler. Sæt dem før første deploy:

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_PRIVAT=price_... \
  STRIPE_PRICE_ERHVERV=price_... \
  STRIPE_PRICE_SETUP=price_... \
  SITE_URL=https://ejendelsregisteret.dk \
  --project-ref ufpuznbsdxwzdkjbkgbu

supabase secrets list --project-ref ufpuznbsdxwzdkjbkgbu
```

`SUPABASE_URL` og service role-nøglen injiceres automatisk — sæt dem ikke selv.

## Deploy

```bash
supabase functions deploy create-checkout     --project-ref ufpuznbsdxwzdkjbkgbu
supabase functions deploy manage-subscription --project-ref ufpuznbsdxwzdkjbkgbu

# Stripe sender ingen Supabase-JWT — uden dette flag afvises alle webhooks med 401
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref ufpuznbsdxwzdkjbkgbu
```

Alle på én gang: `supabase functions deploy --project-ref ufpuznbsdxwzdkjbkgbu`
— men så gælder `--no-verify-jwt` ikke, og `stripe-webhook` skal i stedet have
dette i `config.toml`:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

## Invoke

**Vigtigt:** eksemplet fra Supabase-dashboardet bruger anon-nøglen i
`Authorization`-headeren. Det virker ikke her. `create-checkout` og
`manage-subscription` kører med `auth: "user"` og kræver en rigtig brugers
access token — anon-nøglen giver `401 Ikke logget ind`.

Fra frontenden (nemmest, tokenet sendes med automatisk):

```ts
const { data, error } = await supabase.functions.invoke("create-checkout", {
  body: { planId: "privat" },
});
if (data?.url) window.location.href = data.url;
```

Med curl skal du bruge et brugertoken. Hent det i browserkonsollen på en side
hvor du er logget ind:

```js
(await supabase.auth.getSession()).data.session.access_token;
```

```bash
curl -L -X POST \
  'https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/create-checkout' \
  -H 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  --data '{"planId":"privat"}'
```

`stripe-webhook` kan ikke kaldes med curl — den afviser alt uden en gyldig
Stripe-signatur. Brug Stripe CLI:

```bash
stripe listen --forward-to https://ufpuznbsdxwzdkjbkgbu.supabase.co/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Logs

```bash
supabase functions logs stripe-webhook --project-ref ufpuznbsdxwzdkjbkgbu
```

Eller i dashboardet under Edge Functions → den enkelte funktion → Logs.
`console.error` i webhookens catch-blok lander her.

## Lokalt før deploy

```bash
supabase functions serve
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

`supabase functions serve` læser secrets fra `supabase/.env` — ikke fra
projektets `.env.local`. Den fil skal være gitignored.
