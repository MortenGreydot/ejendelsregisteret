import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Veksler et engangstoken fra en Supabase-mail til en session.
 *
 * Den robuste vej til nulstilling af adgangskode. Alternativet — at lade
 * browseren veksle en ?code= — kræver at mailen åbnes i samme browser som
 * anmodningen kom fra, fordi PKCE-verifieren ligger lokalt. Beder man om
 * nulstilling på telefonen og åbner mailen på computeren, fejler den vej.
 * Her sker vekslingen på serveren, og så er der ingen verifier i spil.
 *
 * Kræver at mailskabelonen i Supabase peger herpå:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 *
 * Bruger skabelonen stadig {{ .ConfirmationURL }}, går brugeren udenom den
 * her rute, og /nulstil-adgangskode veksler koden i browseren i stedet.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Hvor brugeren skal ende. Kun interne stier accepteres: uden den
  // begrænsning ville linket i en mail kunne sende folk til et fremmed
  // domæne med vores adresse som afsender.
  const next = searchParams.get("next") ?? "/nulstil-adgangskode";
  const destination = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/nulstil-adgangskode";

  if (!tokenHash || !type) {
    redirect("/nulstil-adgangskode?fejl=mangler");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("auth/confirm:", error.message);
    redirect("/nulstil-adgangskode?fejl=ugyldig");
  }

  // Sessionen ligger nu i en cookie, sat af serverklienten.
  redirect(destination);
}
