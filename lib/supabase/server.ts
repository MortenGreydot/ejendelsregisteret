import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        /** Giver Supabase alle cookies på den indkommende request. */
        getAll() {
          return cookieStore.getAll();
        },
        /** Kaldes når Supabase har fornyet sessionen og vil gemme den. */
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Kaldt fra en Server Component, hvor cookies er read-only.
            // proxy.ts har allerede skrevet de fornyede cookies på svaret.
          }
        },
      },
    },
  );
}
