-- Henvendelser fra en finder til en ejer.
--
-- Kontakten går gennem os, netop så de to ikke skal udveksle oplysninger:
-- finderen ser aldrig ejerens mail, og ejeren ser aldrig finderens. Begge
-- dele er lovet på serienummersiden, og det løfte skal holdes i koden og
-- ikke kun i teksten.
--
-- Rækkerne gemmes, fordi vi er mellemled. Skriver ejeren tilbage, skal vi
-- kunne se hvem henvendelsen kom fra — og bliver formularen misbrugt, er
-- det her sporet ligger.

create table if not exists public.contact_requests (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.items(id) on delete cascade,
  -- Ejeren på afsendelsestidspunktet. Skifter ejendelen hænder senere,
  -- skal henvendelsen stadig kunne henføres til den der fik den.
  owner_id     uuid references auth.users(id) on delete set null,
  finder_name  text not null,
  finder_email text not null,
  finder_phone text,
  message      text not null,
  created_at   timestamptz not null default now()
);

create index if not exists contact_requests_item
  on public.contact_requests (item_id, created_at desc);

create index if not exists contact_requests_owner
  on public.contact_requests (owner_id, created_at desc);

alter table public.contact_requests enable row level security;
-- Ingen policies. Hverken finder eller ejer må læse tabellen: finderens
-- mail står i rækken, og den er hele pointen at holde skjult. Kun service
-- role rører den, og det gør kun edge-funktionen.
