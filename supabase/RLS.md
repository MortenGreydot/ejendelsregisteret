# Row Level Security

Uden RLS er `subscriptions`, `items`, `payments` og `billing_usage` læsbare på
tværs af brugere, så snart tabellerne er eksponeret på Data API'et. Det gælder
også selvom frontenden altid filtrerer på `user_id` — filtreringen sker i
klienten og kan ændres i devtools.

`create-checkout` og `manage-subscription` læser bevidst gennem den RLS-scopede
klient (`ctx.supabase`, ikke `ctx.supabaseAdmin`) netop for at databasen selv
håndhæver, at en bruger kun kan røre sine egne rækker. **Er RLS ikke slået til,
er den beskyttelse ren dekoration.**

Kør SQL'en nedenfor i SQL Editor i Supabase Dashboard, eller læg den i en
migration når CLI'en er sat op.

---

## Grundprincipper brugt her

**`(select auth.uid())` — ikke `auth.uid()`.** Uden `select` kaldes funktionen
én gang per række. Med `select` cacher Postgres resultatet for hele queryen.
Forskellen er 5–10x på tabeller af en vis størrelse.

**`TO authenticated` frem for `auth.role() = 'authenticated'`.** Sidstnævnte er
deprecated og går i stykker hvis anonyme logins slås til, fordi anonyme brugere
også bærer rollen `authenticated`.

**`TO authenticated` alene er ikke autorisation.** Det tjekker kun at nogen er
logget ind — ikke *hvem*. Derfor har hver policy også et ejerskabsprædikat.

**UPDATE kræver både `USING` og `WITH CHECK`.** `USING` bestemmer hvilke rækker
der må opdateres, `WITH CHECK` hvad de må opdateres *til*. Mangler `WITH CHECK`,
kan en bruger sætte `user_id` til en andens id og forære rækken væk.

**UPDATE og DELETE kræver også en SELECT-policy.** Postgres skal læse rækken før
den kan ændre den. Uden SELECT-policy returnerer opdateringer 0 rækker — ingen
fejl, bare ingenting.

**Skrivninger fra Stripe-webhooken rammer ikke policies.** Den bruger
service_role, som omgår RLS. Derfor har `subscriptions`, `payments` og
`billing_usage` bevidst *kun* SELECT-policies for brugere.

---

## 1. `profiles`

Brugeren ejer sin egen profil. Ingen DELETE-policy — profilen forsvinder med
brugeren via `ON DELETE CASCADE` på foreign key'en til `auth.users`.

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create index if not exists profiles_user_id_idx on public.profiles (user_id);
```

**Vigtigt:** `account_type` styrer om brugeren er privat eller erhverv, og
sættes af `create-checkout` ud fra den betalte plan. Policy'en ovenfor lader
brugeren selv opdatere kolonnen. RLS kan ikke begrænse enkelte kolonner — det
gøres med et column-grant:

```sql
revoke update (account_type) on public.profiles from authenticated;
```

---

## 2. `subscriptions`

Kun læseadgang. Al skrivning sker fra edge functions med service_role. Uden
denne begrænsning kunne en bruger sætte `status = 'active'` og få gratis adgang.

```sql
alter table public.subscriptions enable row level security;

create policy "subscriptions_select_own"
  on public.subscriptions for select
  to authenticated
  using ( (select auth.uid()) = user_id );

-- Bevidst ingen insert/update/delete-policy for brugere.

create unique index if not exists subscriptions_user_id_key
  on public.subscriptions (user_id);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id);
```

De sidste to indexes er ikke pynt: webhooken slår rækker op på netop
`stripe_customer_id` og `stripe_subscription_id`. UNIQUE på `user_id` er et krav
for at `create-checkout`s `upsert(..., { onConflict: "user_id" })` virker.

---

## 3. `categories`

Fælles opslagsdata. Alle må læse, ingen må skrive.

```sql
alter table public.categories enable row level security;

create policy "categories_select_all"
  on public.categories for select
  to anon, authenticated
  using ( true );
```

---

## 4. `items`

Den eneste tabel hvor brugeren har fuld CRUD.

```sql
alter table public.items enable row level security;

create policy "items_select_own"
  on public.items for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create policy "items_insert_own"
  on public.items for insert
  to authenticated
  with check ( (select auth.uid()) = user_id );

create policy "items_update_own"
  on public.items for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

create policy "items_delete_own"
  on public.items for delete
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists items_user_id_idx on public.items (user_id);
```

`items_user_id_idx` betyder også noget for fakturering: webhooken tæller
`items` per bruger hver måned for at beregne ekstra ejendele.

---

## 5. `item_images` og `item_documents`

De her tabeller har ingen `user_id`. Ejerskab afgøres gennem `item_id` →
`items.user_id`, så policy'en skal joine.

```sql
alter table public.item_images enable row level security;

create policy "item_images_select_own"
  on public.item_images for select
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "item_images_insert_own"
  on public.item_images for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "item_images_delete_own"
  on public.item_images for delete
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_images.item_id
        and items.user_id = (select auth.uid())
    )
  );

create index if not exists item_images_item_id_idx
  on public.item_images (item_id);
```

Samme fire statements for `item_documents` — udskift tabelnavnet:

```sql
alter table public.item_documents enable row level security;

create policy "item_documents_select_own"
  on public.item_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_documents.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "item_documents_insert_own"
  on public.item_documents for insert
  to authenticated
  with check (
    exists (
      select 1 from public.items
      where items.id = item_documents.item_id
        and items.user_id = (select auth.uid())
    )
  );

create policy "item_documents_delete_own"
  on public.item_documents for delete
  to authenticated
  using (
    exists (
      select 1 from public.items
      where items.id = item_documents.item_id
        and items.user_id = (select auth.uid())
    )
  );

create index if not exists item_documents_item_id_idx
  on public.item_documents (item_id);
```

Ingen UPDATE-policy: en fil erstattes ved at slette rækken og indsætte en ny.
Skal filnavne kunne redigeres, tilføj en UPDATE-policy med samme `EXISTS` i både
`USING` og `WITH CHECK`.

`EXISTS`-subqueryen koster et indexopslag per række. Bliver det for dyrt ved
mange billeder, kan opslaget flyttes til en `SECURITY DEFINER`-funktion i et
ikke-eksponeret schema — men først når du har målt det, for `SECURITY DEFINER`
omgår RLS og skal håndteres omhyggeligt.

---

## 6. `billing_usage` og `payments`

Læseadgang til egne rækker. Skrives udelukkende af `stripe-webhook`.

```sql
alter table public.billing_usage enable row level security;

create policy "billing_usage_select_own"
  on public.billing_usage for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists billing_usage_user_id_idx
  on public.billing_usage (user_id);

create unique index if not exists billing_usage_user_month_key
  on public.billing_usage (user_id, billing_month);
```

UNIQUE på `(user_id, billing_month)` gør idempotensen i `onInvoiceCreated` til
en garanti frem for et kapløb: sender Stripe det samme `invoice.created`-event
to gange samtidig, kan `select`-tjekket i koden nå at fejle for begge. Med et
unikt index afvises den anden indsættelse af databasen.

Indexet forudsætter **én fornyelse pr. kalendermåned**. Tester du med daglige
abonnementer, afviser det den anden fornyelse i samme måned. Brug i så fald
fakturaen som nøgle i stedet — se README'ets afsnit
"Daglige abonnementer til test":

```sql
create unique index if not exists billing_usage_stripe_invoice_id_key
  on public.billing_usage (stripe_invoice_id);
```

```sql
alter table public.payments enable row level security;

create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists payments_user_id_idx on public.payments (user_id);

create index if not exists payments_stripe_invoice_id_idx
  on public.payments (stripe_invoice_id);
```

---

## 7. Storage buckets

Begge buckets skal være **private**. Er `item-documents` public, kan hvem som
helst med URL'en hente kvitteringer og garantibeviser.

```sql
update storage.buckets set public = false
where id in ('item-images', 'item-documents');
```

Policies på `storage.objects` bygger på mappestrukturen i stien:

```sql
create policy "item_images_own_folder"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "item_documents_own_folder"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'item-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'item-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
```

**Det her stiller et krav til uploadkoden.** Policy'en læser første mappe i
stien som bruger-id, så filer skal ligge på:

```
item-images/<user_id>/<item_id>/<filnavn>
```

Uploader appen til en flad sti, matcher policy'en ikke, og alle uploads afvises.

Bemærk at `for all` dækker SELECT, INSERT, UPDATE og DELETE. Det er med vilje:
upsert af en fil kræver INSERT + SELECT + UPDATE. Gives kun INSERT, fejler
filerstatning stille.

---

## 8. Data API-adgang

Nye tabeller eksponeres ikke længere automatisk på Data API'et. Får frontenden
`relation does not exist` selvom tabellen findes, mangler rollerne adgang:

```sql
grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;

grant select, insert, update, delete on public.items to authenticated;
grant select, insert, delete on public.item_images to authenticated;
grant select, insert, delete on public.item_documents to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_usage to authenticated;
grant select on public.payments to authenticated;
```

GRANT og RLS er to forskellige lag: GRANT afgør om tabellen overhovedet kan
nås, RLS afgør hvilke rækker der er synlige. Begge skal være på plads.

---

## 9. Verifikation

Find tabeller uden RLS:

```sql
select tablename
from pg_tables
where schemaname = 'public'
  and rowsecurity = false;
```

Se alle policies:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

Kør derefter Supabases egen sikkerhedsgennemgang, som fanger ting denne fil
ikke dækker — fx views uden `security_invoker`:

```bash
supabase db advisors
```

Den rigtige test er dog stadig manuel: log ind som bruger A, prøv at hente
bruger B's `items` og `payments`, og bekræft at der kommer nul rækker tilbage.
