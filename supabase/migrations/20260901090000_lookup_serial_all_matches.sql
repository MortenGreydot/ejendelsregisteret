-- Serienummeropslaget returnerede kun én række — og valgte den tilfældigt.
--
-- Fejlen: `limit 1` uden `order by`. To ejendele kan sagtens dele et
-- serienummer; "123456" står på både en cykel og en telefon, og der findes
-- ingen myndighed der uddeler dem globalt unikt. Uden en sortering
-- returnerede Postgres den række der lå først på disken.
--
-- Konsekvensen var den værst tænkelige for det her produkt: var det ene
-- eksemplar meldt stjålet og det andet ikke, kunne opslaget svare "ikke
-- meldt savnet eller stjålet" om en genstand der stod som stjålet. Præcis
-- det opslaget findes for at forhindre.
--
-- Nu returneres alle træffere, med de flagede først. Finderen kan så selv
-- sammenligne mærke, kategori og billeder — hvilket siden allerede beder
-- dem om — i stedet for at vi gætter på deres vegne.
--
-- Loftet på 5 er en bremse mod at et meget almindeligt nummer som "1234"
-- returnerer en hel liste af fremmede menneskers ejendele.

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
  -- Stjålet før savnet før registreret. Er der noget galt med en af dem,
  -- skal det stå øverst — ikke gemt bag en harmløs række.
  order by
    case i.status
      when 'stolen' then 0
      when 'lost' then 1
      else 2
    end,
    i.status_changed_at desc nulls last,
    i.created_at desc
  limit 5;
$$;

grant execute on function public.lookup_serial(text) to anon, authenticated;
