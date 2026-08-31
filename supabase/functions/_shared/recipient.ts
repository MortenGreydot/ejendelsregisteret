import type { SupabaseClient } from "npm:@supabase/supabase-js";

/**
 * Slår modtagerens mailadresse og navn op. (modtager)
 *
 * Mailen står i auth.users, navnet i profiles — derfor to opslag. Kun
 * service role-klienten kan læse auth.users, så den skal komme fra
 * ctx.supabaseAdmin.
 *
 * Returnerer null hvis brugeren ikke findes eller mangler mail. Kalderen
 * springer så mailen over frem for at fejle: en manglende velkomstmail må
 * aldrig vælte den betaling eller sletning der udløste den.
 */
export async function getRecipient(
  admin: SupabaseClient,
  userId: string,
): Promise<{ email: string; name: string | null } | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("user_id", userId)
    .maybeSingle();

  return { email: data.user.email, name: profile?.full_name ?? null };
}
