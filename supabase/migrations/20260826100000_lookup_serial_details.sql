-- Udvider serienummer-opslaget med navn, beskrivelse og billeder.
--
-- Begrundelsen: kender man hele serienummeret, har man som regel genstanden
-- i hånden. Så er navn, beskrivelse og fotos præcis det man skal bruge for
-- at kontrollere om det er den samme genstand — hvilket er hele pointen med
-- et opslag.
--
-- Hvad der stadig IKKE returneres, og hvorfor:
--   * ejerens navn, e-mail og user_id — et opslag må ikke kunne bruges til
--     at finde frem til et menneske
--   * kvitteringer og dokumenter — de indeholder pris, adresse og ofte
--     kortoplysninger, og har intet med identifikation af genstanden at gøre
--
-- Matchningen er uændret: eksakt og med minimum 4 tegn.

-- Returtypen ændrer sig, og det tillader `create or replace` ikke på en
-- tabel-returnerende funktion. Den skal droppes og genskabes.
drop function if exists public.lookup_serial(text);

create function public.lookup_serial(raw_serial text)
returns table (
  item_id uuid,
  name text,
  description text,
  status public.item_status,
  brand text,
  category text,
  status_changed_at timestamptz,
  image_paths text[]
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
    i.name,
    i.description,
    i.status,
    i.brand,
    c.name,
    i.status_changed_at,
    coalesce(
      (
        select array_agg(im.file_path order by im.created_at)
        from public.item_images im
        where im.item_id = i.id
      ),
      '{}'::text[]
    )
  from normaliseret n
  join public.item_serials s on s.serial_normalized = n.q
  join public.items i on i.id = s.item_id
  left join public.categories c on c.id = i.category_id
  where length(n.q) >= 4
  limit 1;
$$;

grant execute on function public.lookup_serial(text) to anon, authenticated;
