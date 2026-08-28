-- Kræver et aktivt medlemskab for at oprette ejendele.
--
-- En bruger der oprettede konto men afbrød eller fejlede betalingen, fik
-- status pending_activation — og kunne alligevel oprette ejendele, fordi
-- INSERT-policyen kun tjekkede ejerskab.
--
-- At skjule knappen i brugerfladen er ikke nok: PostgREST er et offentligt
-- API, og enhver med et gyldigt token kan poste direkte til /rest/v1/items.
-- Spærringen skal derfor stå i policyen.

/**
 * Har den kaldende bruger et aktivt abonnement?
 *
 * SECURITY DEFINER, så opslaget ikke selv skal gennem RLS på subscriptions.
 * Uden det ville en policy på items kalde en policy på subscriptions ved
 * hver eneste indsættelse.
 *
 * Funktionen tager ingen parametre og bruger auth.uid() internt. Den kan
 * derfor kun svare på noget om kalderen selv og lækker intet om andre.
 */
create or replace function public.has_active_subscription()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = (select auth.uid())
      and status = 'active'
  );
$$;

-- Postgres giver EXECUTE til PUBLIC på nye funktioner.
revoke execute on function public.has_active_subscription() from public, anon;
grant  execute on function public.has_active_subscription() to authenticated;

drop policy if exists "items_insert_own" on public.items;

create policy "items_insert_own" on public.items
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.has_active_subscription()
  );

-- Bemærk: kun oprettelse spærres. Eksisterende ejendele kan stadig
-- redigeres og slettes — en bruger skal kunne hente sin dokumentation ud
-- og rydde op, selvom betalingen er gået i stå.
