-- Serienumre og telefonnummer.
--
-- items havde intet felt til serienummer, selvom hele produktet handler om
-- at kunne dokumentere ejerskab via serienummer. Designet viser desuden to
-- numre på samme ejendel (kamerahus + objektiv), så det er en 1:mange-
-- relation og ikke en enkelt kolonne.

create table if not exists public.item_serials (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items(id) on delete cascade,
  serial      text not null,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists item_serials_item_idx on public.item_serials (item_id);

alter table public.item_serials enable row level security;

-- Samme mønster som item_images: ejerskabet ligger på items, så adgangen
-- afgøres af om brugeren ejer den ejendel rækken hører til.
create policy "item_serials_select_own" on public.item_serials
  for select to authenticated
  using (exists (
    select 1 from public.items i
    where i.id = item_serials.item_id and i.user_id = (select auth.uid())
  ));

create policy "item_serials_insert_own" on public.item_serials
  for insert to authenticated
  with check (exists (
    select 1 from public.items i
    where i.id = item_serials.item_id and i.user_id = (select auth.uid())
  ));

create policy "item_serials_update_own" on public.item_serials
  for update to authenticated
  using (exists (
    select 1 from public.items i
    where i.id = item_serials.item_id and i.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.items i
    where i.id = item_serials.item_id and i.user_id = (select auth.uid())
  ));

create policy "item_serials_delete_own" on public.item_serials
  for delete to authenticated
  using (exists (
    select 1 from public.items i
    where i.id = item_serials.item_id and i.user_id = (select auth.uid())
  ));

grant select, insert, update, delete on public.item_serials to authenticated;

-- Telefonnummer på profilen. Designet har feltet, skemaet havde det ikke.
alter table public.profiles add column if not exists phone text;
