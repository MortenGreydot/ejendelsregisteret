-- Hastighedsloft for kontaktformularen.
--
-- send-contact er nødt til at være åben: folk der har fundet noget, har
-- sjældent en konto. Men et offentligt endpoint der sender mail kan
-- misbruges til at tømme vores Resend-kvote og få domænet flagget.
--
-- Vi gemmer et saltet hash af IP'en, ikke IP'en selv. Til formålet — at
-- kende to indsendelser fra hinanden i en time — er hashet lige så godt,
-- og så ligger der ikke personhenførbare adresser i databasen.

create table if not exists public.contact_rate_limit (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_rate_limit_lookup
  on public.contact_rate_limit (ip_hash, created_at desc);

alter table public.contact_rate_limit enable row level security;
-- Ingen policies: kun service role rører den her.

/**
 * Registrerer en indsendelse og svarer, om den må sendes.
 *
 * Rydder op undervejs. Rækkerne har ingen værdi når timen er gået, og en
 * separat oprydning ville være endnu et cronjob at holde øje med.
 */
create or replace function public.check_contact_rate(
  hashed_ip text,
  max_per_hour integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  delete from public.contact_rate_limit
  where created_at < now() - interval '1 hour';

  select count(*) into recent
  from public.contact_rate_limit
  where ip_hash = hashed_ip
    and created_at > now() - interval '1 hour';

  if recent >= max_per_hour then
    return false;
  end if;

  insert into public.contact_rate_limit (ip_hash) values (hashed_ip);
  return true;
end;
$$;

revoke execute on function public.check_contact_rate(text, integer)
  from public, anon, authenticated;
