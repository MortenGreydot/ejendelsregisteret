# ejendelsregisteret

Danmarks digitale tingbog for værdigenstande.

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 · Supabase (auth, database, edge functions) · Stripe (abonnement).

## Kom i gang

```bash
npm install
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000).

Kræver en `.env.local` med:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Brug den *publishable* nøgle. Den hemmelige service role-nøgle må aldrig få
`NEXT_PUBLIC_`-prefiks — alt med det prefiks sendes til browseren.

## Dokumentation

| Dokument | Indhold |
| --- | --- |
| [supabase/README.md](supabase/README.md) | Stripe-opsætning, priser, faktureringsfrekvens |
| [supabase/RLS.md](supabase/RLS.md) | Row level security-policies for alle tabeller |
| [supabase/DEPLOY.md](supabase/DEPLOY.md) | Opret, deploy og kald edge functions |
| [supabase/database.md](supabase/database.md) | Skemaoversigt over de 8 tabeller |

**Læs `RLS.md` inden databasen tages i brug.** Uden policies er
`subscriptions`, `items`, `payments` og `billing_usage` læsbare på tværs af
brugere, så snart tabellerne er eksponeret på Data API'et.

## Scripts

| Kommando        | Beskrivelse                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Udviklingsserver (Turbopack) |
| `npm run build` | Produktions-build            |
| `npm run start` | Kører produktions-build      |
| `npm run lint`  | ESLint                       |

## Struktur

```
app/                 App Router: layout, sider, komponenter
  components/        Delte komponenter (Navbar, AuthDialog, …)
    frontpage/       Forsidens sektioner
lib/                 Supabase-klienter og plandata
supabase/            Edge functions (Stripe) og dokumentation
emails/              HTML-templates til udgående mails
proxy.ts             Fornyer Supabase-sessionen på hver request
public/              Statiske filer
```
