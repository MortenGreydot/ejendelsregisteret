-- Opretter automatisk en profiles-række når en bruger registreres.
--
-- Skemaet beskriver profiles som 1:1 med auth.users, men intet håndhævede
-- det. Resultatet var at create-checkout's `update ... where user_id = ...`
-- ramte nul rækker uden at fejle, så account_type aldrig blev gemt.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    user_id, account_type, full_name, company_name, cvr_number
  )
  values (
    new.id,
    -- Valideres mod CHECK-constraintens tilladte værdier. Feltet er
    -- brugerstyret (det kommer fra signup-formularen), så det er et
    -- segmenteringsfelt — aldrig et adgangskriterium. Den rigtige
    -- kontotype sættes af create-checkout ud fra den betalte plan.
    case new.raw_user_meta_data ->> 'account_type'
      when 'business' then 'business'
      else 'private'
    end,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'company_name', ''),
    nullif(new.raw_user_meta_data ->> 'cvr_number', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- SECURITY DEFINER er nødvendig: triggeren kører i auth-schemaet og skal
-- kunne skrive i public.profiles. Men Postgres giver som udgangspunkt
-- EXECUTE til PUBLIC på nye funktioner, hvilket ville gøre den til et
-- offentligt kaldbart endpoint for anon og authenticated. Derfor:
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Brugere oprettet før triggeren fandtes.
insert into public.profiles (
  user_id, account_type, full_name, company_name, cvr_number
)
select
  id,
  case raw_user_meta_data ->> 'account_type'
    when 'business' then 'business'
    else 'private'
  end,
  nullif(raw_user_meta_data ->> 'full_name', ''),
  nullif(raw_user_meta_data ->> 'company_name', ''),
  nullif(raw_user_meta_data ->> 'cvr_number', '')
from auth.users
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------
-- Synkronisering ved ændring
-- ---------------------------------------------------------------------
--
-- INSERT-triggeren ovenfor dækker kun oprettelsen. Ændrer en bruger senere
-- sine oplysninger i raw_user_meta_data, ville profiles blive stående med
-- de gamle værdier.
--
-- Bemærk retningen: metadata er kilden her, og metadata er brugerredigerbart.
-- Derfor opdateres account_type IKKE herfra — ellers kunne en bruger sætte
-- sin egen konto til 'business' ved at ændre sine metadata. Kontotypen
-- ejes af create-checkout, som sætter den ud fra den plan der blev betalt.

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set
    full_name    = coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), full_name),
    company_name = coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), company_name),
    cvr_number   = coalesce(nullif(new.raw_user_meta_data ->> 'cvr_number', ''), cvr_number)
  where user_id = new.id;

  return new;
end;
$$;

revoke execute on function public.handle_user_update() from public, anon, authenticated;

drop trigger if exists on_auth_user_updated on auth.users;

-- Kun når metadata faktisk ændrer sig. Uden when-klausulen ville triggeren
-- fyre ved hvert login, da auth.users opdateres med last_sign_in_at.
create trigger on_auth_user_updated
after update on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function public.handle_user_update();
