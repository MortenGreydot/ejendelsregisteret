/**
 * Oversætter fejl fra Supabase til noget en bruger kan handle på.
 *
 * Supabase svarer på engelsk og i teknisk sprog: "new row violates
 * row-level security policy for table \"items\"" eller "Invalid login
 * credentials". Sætter man den slags direkte i brugerfladen, får folk en
 * besked de hverken forstår eller kan gøre noget ved.
 *
 * Reglen her er: brugeren ser en dansk sætning der siger hvad der gik galt
 * og hvad de kan gøre. Den tekniske original ryger i konsollen, så den
 * stadig kan fejlsøges.
 *
 * Kilderne har hver deres fejlformat, og alle tre er dækket:
 *   - Auth (login, oprettelse) → `code` som "invalid_credentials"
 *   - PostgREST (tabeller, RPC) → `code` som SQLSTATE, fx "42501"
 *   - Storage (filer) → kun en besked, ingen brugbar kode
 */

/** Fejl fra login og oprettelse. Nøglen er AuthError.code. */
const AUTH: Record<string, string> = {
  invalid_credentials: "Forkert e-mail eller adgangskode.",
  email_not_confirmed:
    "Din e-mail er ikke bekræftet endnu. Tjek din indbakke — også spamfilteret.",
  email_exists:
    "Der findes allerede en konto med den e-mail. Log ind i stedet for at oprette en ny.",
  user_already_exists:
    "Der findes allerede en konto med den e-mail. Log ind i stedet for at oprette en ny.",
  weak_password:
    "Adgangskoden er for kort. Brug mindst 8 tegn — gerne flere ord i træk.",
  validation_failed: "Tjek at e-mailen er skrevet rigtigt.",
  over_request_rate_limit:
    "Der er prøvet for mange gange på kort tid. Vent et minut og prøv igen.",
  over_email_send_rate_limit:
    "Der er sendt for mange mails til den adresse. Vent et par minutter og prøv igen.",
  same_password: "Den nye adgangskode skal være en anden end den gamle.",
  signup_disabled: "Der kan ikke oprettes nye konti lige nu. Prøv igen senere.",
  session_expired: "Du er blevet logget ud. Log ind igen for at fortsætte.",
  refresh_token_not_found:
    "Du er blevet logget ud. Log ind igen for at fortsætte.",
  user_not_found: "Vi kunne ikke finde en konto med de oplysninger.",
  email_address_invalid: "Den e-mailadresse ser ikke rigtig ud.",
};

/**
 * Fejl fra databasen. Nøglen er PostgreSQL's SQLSTATE.
 *
 * P0001 mangler bevidst: det er `raise exception` fra vores egne
 * databasefunktioner, og de beskeder er allerede skrevet på dansk til
 * brugeren. Dem sender vi videre uændret.
 */
const POSTGREST: Record<string, string> = {
  "42501": "Du har ikke adgang til det her.",
  "23505": "Det findes allerede.",
  "23503": "Der mangler noget den her oplysning hænger sammen med.",
  "23514": "En af værdierne er ikke gyldig.",
  "23502": "Der mangler et påkrævet felt.",
  "22001": "En af teksterne er for lang.",
  "22P02": "En af værdierne har et forkert format.",
  PGRST301: "Du er blevet logget ud. Log ind igen for at fortsætte.",
  PGRST116: "Vi kunne ikke finde det, du søgte efter.",
  "57014": "Det tog for lang tid. Prøv igen.",
};

/**
 * Storage svarer uden brugbare koder, så her matches der på beskeden.
 * Rækkefølgen betyder noget — første match vinder.
 */
const STORAGE: [RegExp, string][] = [
  [/exceeded the maximum allowed size|payload too large|413/i,
   "Filen er for stor. Den må højst fylde 10 MB."],
  [/row-level security|not authorized|403/i,
   "Du har ikke adgang til at lægge filer op her."],
  [/already exists|duplicate/i,
   "Der ligger allerede en fil med det navn. Omdøb den og prøv igen."],
  [/mime type|invalid file type/i,
   "Filtypen understøttes ikke."],
  [/bucket not found/i,
   "Der er noget galt med fillageret. Prøv igen om lidt."],
];

/** Netværk og forbindelse — genkendes på tværs af alle tre kilder. */
const NETWORK =
  /failed to fetch|network ?error|load failed|networkerror|err_internet|failed to send a request/i;

const NETWORK_MESSAGE =
  "Vi kunne ikke få forbindelse. Tjek dit internet og prøv igen.";

/**
 * Laver en fejl om til en dansk besked.
 *
 * `fallback` er hvad brugeren ser, når fejlen ikke kan genkendes — skriv
 * den i forhold til hvad brugeren forsøgte, fx "Ejendelen kunne ikke
 * gemmes." Skriv aldrig "Der skete en fejl": det fortæller intet om hvad
 * der ikke lykkedes.
 *
 * `overrides` giver et bedre svar på en kode i netop denne sammenhæng.
 * 42501 på items betyder fx "du mangler et aktivt medlemskab", mens den på
 * profiles bare betyder "det er ikke din profil".
 */
export function userMessage(
  error: unknown,
  fallback: string,
  overrides?: Record<string, string>,
): string {
  if (!error) return fallback;

  // Den tekniske original skal stadig kunne findes ved fejlsøgning.
  console.error("Fejl:", error);

  const raw = typeof error === "string" ? error : "";
  const object = (typeof error === "object" && error ? error : {}) as {
    code?: unknown;
    message?: unknown;
    error_description?: unknown;
    name?: unknown;
  };

  const code = typeof object.code === "string" ? object.code : "";
  const message =
    raw ||
    (typeof object.message === "string" ? object.message : "") ||
    (typeof object.error_description === "string"
      ? object.error_description
      : "");

  if (overrides?.[code]) return overrides[code];

  // Databasefunktionernes egne `raise exception` er allerede på dansk og
  // langt mere præcise end noget vi kan gætte os til her.
  if (code === "P0001" && message) return message;

  if (AUTH[code]) return AUTH[code];
  if (POSTGREST[code]) return POSTGREST[code];

  if (NETWORK.test(message)) return NETWORK_MESSAGE;

  // Kommer der en RLS-afvisning uden kode, skal kalderens egen besked have
  // forrang. Ellers ville en afvist INSERT på items ramme STORAGE nedenfor
  // og fortælle brugeren noget om filupload, som slet ikke var det de gjorde.
  const deniedByPolicy = /row-level security/i.test(message);
  if (deniedByPolicy && overrides?.["42501"]) return overrides["42501"];

  for (const [pattern, translation] of STORAGE) {
    if (pattern.test(message)) return translation;
  }

  if (deniedByPolicy) return POSTGREST["42501"];

  // Ældre klienter sender besked uden kode. De hyppigste dækkes her, så en
  // biblioteksopdatering ikke pludselig lader engelsk tekst slippe igennem.
  if (/invalid login credentials/i.test(message)) return AUTH.invalid_credentials;
  if (/already registered|already exists/i.test(message)) return AUTH.email_exists;
  if (/email not confirmed/i.test(message)) return AUTH.email_not_confirmed;
  if (/password should be at least|weak password/i.test(message))
    return AUTH.weak_password;
  if (/rate limit|too many requests/i.test(message))
    return AUTH.over_request_rate_limit;
  if (/jwt expired|token is expired|invalid claim/i.test(message))
    return POSTGREST.PGRST301;
  return fallback;
}

/**
 * Til fejl vi selv har formuleret på serversiden.
 *
 * Edge-funktionerne svarer allerede med danske beskeder, men rammer man en
 * uventet fejl derinde, kan der stadig komme engelsk teknisk tekst med. Er
 * beskeden tydeligvis engelsk maskintekst, bruges fallback i stedet.
 */
export function serverMessage(
  error: string | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;

  if (NETWORK.test(error)) return NETWORK_MESSAGE;

  // Stripe og Deno svarer på engelsk. Et dansk bogstav eller et af de få
  // ord vi selv bruger er nok til at se at beskeden er skrevet til en bruger.
  const looksDanish =
    /[æøåÆØÅ]/.test(error) ||
    /\b(kunne|skal|ikke|du|der|dit|din|allerede|ukendt|ingen|prøv|mangler)\b/i.test(
      error,
    );

  if (looksDanish) return error;

  console.error("Uoversat serverfejl:", error);
  return fallback;
}
