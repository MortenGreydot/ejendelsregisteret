-- Offentligt opslag på serienummer.
--
-- Kerneidéen i produktet: en finder eller politiet skal kunne slå et
-- serienummer op og se at genstanden er registreret — uden at kunne finde
-- ud af hvem der ejer den, og uden at kunne bladre i andres ting.

-- 1. Normaliseret form, så skrivevarianter rammer samme række.
--    "WTU-2310 04568", "wtu231004568" og "WTU 2310-04568" bliver alle til
--    "WTU231004568". Genereret kolonne frem for en trigger: værdien kan
--    ikke komme ud af sync med serial, uanset hvordan rækken opdateres.
alter table public.item_serials
  add column if not exists serial_normalized text
  generated always as (
    upper(regexp_replace(serial, '[^a-zA-Z0-9]', '', 'g'))
  ) stored;

create index if not exists item_serials_normalized_idx
  on public.item_serials (serial_normalized);

-- 2. Opslagsfunktionen.
create or replace function public.lookup_serial(raw_serial text)
returns table (
  item_id uuid,
  status public.item_status,
  brand text,
  category text,
  status_changed_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  with normaliseret as (
    select upper(regexp_replace(coalesce(raw_serial, ''), '[^a-zA-Z0-9]', '', 'g')) as q
  )
  select
    i.id,
    i.status,
    i.brand,
    c.name,
    i.status_changed_at
  from normaliseret n
  join public.item_serials s on s.serial_normalized = n.q
  join public.items i on i.id = s.item_id
  left join public.categories c on c.id = i.category_id
  -- Minimumslængde: uden den ville "AB" kunne ramme tilfældige rækker og
  -- gøre det muligt at fiske efter registrerede genstande.
  where length(n.q) >= 4
  limit 1;
$$;

-- Returnerer BEVIDST intet om ejeren: ikke navn, ikke e-mail, ikke user_id,
-- ikke ejendelens navn. Kun at nummeret findes, hvad status er, og mærke
-- plus kategori så finderen kan bekræfte at det er den rigtige genstand.
--
-- Der matches udelukkende eksakt. Ingen LIKE, intet præfiks — ellers ville
-- funktionen være en søgemaskine over andres ejendele.
--
-- SECURITY DEFINER er nødvendig: opslaget skal virke for en finder der ikke
-- er logget ind, og RLS på items og item_serials tillader kun ejeren at læse.
-- Derfor er det afgørende hvad der returneres, ikke hvem der kalder.
grant execute on function public.lookup_serial(text) to anon, authenticated;
