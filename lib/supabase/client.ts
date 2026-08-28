import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase-klient til browseren.

 * Bruges kun i filer med "use client" øverst:
 *   AuthDialog     → signInWithPassword / signUp
 *   AuthMenu       → onAuthStateChange
 *   SignOutButton  → signOut
 *
 * Hvorfor en funktion og ikke en delt singleton på modulniveau?
 * Klienten holder på sessionen. Oprettes den én gang på modulniveau, deles
 * den instans på tværs af renders og hot reloads, og i værste fald mellem
 * requests hvis modulet ved en fejl importeres server-side. Ved at kalde
 * createClient() dér hvor den skal bruges, får hver komponent sin egen —
 * @supabase/ssr deduplikerer selv den underliggende session via cookies.
 *
 * Nøglen:
 * NEXT_PUBLIC_-prefikset betyder at værdien inlines i browser-bundlen og er
 * offentligt læsbar. Det er i orden her, fordi det er den *publishable* nøgle,
 * som kun kan det `anon`-rollen har lov til gennem RLS. Den hemmelige
 * service_role-nøgle må ALDRIG få NEXT_PUBLIC_-prefiks — den omgår RLS.
 *
 * `!` efter env-variablerne er en TypeScript non-null assertion: vi lover
 * compileren at de findes. Gør de ikke det (glemt .env.local), fejler kaldet
 * først i runtime med en uklar fejl fra Supabase.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
