-- Lader brugeren oprette en kategori der ikke findes i forvejen.
--
-- categories havde hverken INSERT-policy eller grant til authenticated, så
-- kun eksisterende kategorier kunne vælges. Et almindeligt INSERT-grant
-- ville til gengæld åbne for skrald: tomme navne, 500 tegn lange navne, og
-- "elektronik" ved siden af "Elektronik".
--
-- Derfor en funktion der normaliserer og selv afgør om der skal indsættes.
-- Klienten sender rå tekst og får et id tilbage.

-- Uden dette indeks ville "Cykler" og "cykler" kunne eksistere side om side;
-- UNIQUE på name alene er versalfølsom.
create unique index if not exists categories_name_lower_idx
  on public.categories (lower(name));

create or replace function public.get_or_create_category(raw_name text)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned  text;
  found_id smallint;
begin
  -- Trim i begge ender, og kollaps indre mellemrum: "  El   tronik " → "El tronik"
  cleaned := btrim(regexp_replace(coalesce(raw_name, ''), '\s+', ' ', 'g'));

  if cleaned = '' then
    return null;
  end if;

  if length(cleaned) > 40 then
    raise exception 'Kategorinavn må højst være 40 tegn';
  end if;

  -- Ensartet visning i listen: stort begyndelsesbogstav.
  cleaned := upper(left(cleaned, 1)) || substr(cleaned, 2);

  -- Versalufølsom opslag, så "cykler" finder den eksisterende "Cykler".
  select id into found_id
    from public.categories
   where lower(name) = lower(cleaned)
   limit 1;

  if found_id is not null then
    return found_id;
  end if;

  insert into public.categories (name)
  values (cleaned)
  on conflict do nothing
  returning id into found_id;

  -- To samtidige kald kan begge nå hertil; den ene taber kapløbet og får
  -- null tilbage fra insert. Så slår vi bare op igen.
  if found_id is null then
    select id into found_id
      from public.categories
     where lower(name) = lower(cleaned)
     limit 1;
  end if;

  return found_id;
end;
$$;

-- Postgres giver EXECUTE til PUBLIC på nye funktioner. Uden dette revoke
-- ville en uautentificeret bruger kunne oprette kategorier.
revoke execute on function public.get_or_create_category(text) from public, anon;
grant  execute on function public.get_or_create_category(text) to authenticated;
