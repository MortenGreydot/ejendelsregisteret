-- Slår Row Level Security til på alle tabeller i public.
--
-- SQL'en i sektionerne nedenfor er hentet fra supabase/RLS.md.
--
-- Trin 0 er tilføjet her og står IKKE i RLS.md: databasen havde allerede
-- uddelt samtlige privilegier (inkl. TRUNCATE og DELETE) til anon og
-- authenticated på alle otte tabeller. RLS.md tilføjer kun de rigtige,
-- minimale grants — den fjerner ikke de gamle. Det er kritisk, fordi
-- TRUNCATE ikke er underlagt RLS: uden revoke kan en uautentificeret
-- bruger tømme hver tabel, uanset hvilke policies der findes.

-- =====================================================================
-- 0. Nulstil eksisterende grants
-- =====================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;


-- =====================================================================
-- 1. `profiles`
-- =====================================================================

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


-- =====================================================================
-- 1. `profiles`
-- =====================================================================

-- (revoke update (account_type) er flyttet til slutningen af filen —
--  et tabelbredt grant i sektion 8 ville ellers give rettigheden tilbage.)


-- =====================================================================
-- 2. `subscriptions`
-- =====================================================================

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


-- =====================================================================
-- 3. `categories`
-- =====================================================================

alter table public.categories enable row level security;

create policy "categories_select_all"
  on public.categories for select
  to anon, authenticated
  using ( true );


-- =====================================================================
-- 4. `items`
-- =====================================================================

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


-- =====================================================================
-- 5. `item_images` og `item_documents`
-- =====================================================================

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


-- =====================================================================
-- 5. `item_images` og `item_documents`
-- =====================================================================

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


-- =====================================================================
-- 6. `billing_usage` og `payments`
-- =====================================================================

alter table public.billing_usage enable row level security;

create policy "billing_usage_select_own"
  on public.billing_usage for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists billing_usage_user_id_idx
  on public.billing_usage (user_id);

create unique index if not exists billing_usage_user_month_key
  on public.billing_usage (user_id, billing_month);


-- =====================================================================
-- 6. `billing_usage` og `payments`
-- =====================================================================

create unique index if not exists billing_usage_stripe_invoice_id_key
  on public.billing_usage (stripe_invoice_id);


-- =====================================================================
-- 6. `billing_usage` og `payments`
-- =====================================================================

alter table public.payments enable row level security;

create policy "payments_select_own"
  on public.payments for select
  to authenticated
  using ( (select auth.uid()) = user_id );

create index if not exists payments_user_id_idx on public.payments (user_id);

create index if not exists payments_stripe_invoice_id_idx
  on public.payments (stripe_invoice_id);


-- =====================================================================
-- 7. Storage buckets
-- =====================================================================

update storage.buckets set public = false
where id in ('item-images', 'item-documents');


-- =====================================================================
-- 7. Storage buckets
-- =====================================================================

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


-- =====================================================================
-- 8. Data API-adgang
-- =====================================================================

grant usage on schema public to anon, authenticated;

grant select on public.categories to anon, authenticated;

grant select, insert, update, delete on public.items to authenticated;
grant select, insert, delete on public.item_images to authenticated;
grant select, insert, delete on public.item_documents to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_usage to authenticated;
grant select on public.payments to authenticated;

-- =====================================================================
-- 10. Kolonne-restriktioner (SKAL stå efter grants i sektion 8)
-- =====================================================================
--
-- Sektion 8 giver 'update' på hele profiles-tabellen. Uden dette revoke
-- kan en bruger sætte sin egen account_type til 'business' og dermed
-- tage erhvervspakken uden at betale for den. Kontotypen sættes kun af
-- create-checkout via service role-klienten.

revoke update (account_type) on public.profiles from authenticated;
