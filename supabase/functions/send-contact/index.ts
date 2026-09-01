import { withSupabase } from "npm:@supabase/server";

import { contactMessage } from "../_shared/mails.ts";

/**
 * Tager imod kontaktformularen og sender beskeden til kontaktadressen.
 *
 * Åben uden login. Folk der har fundet noget og vil skrive til os, har
 * sjældent en konto — kravet om at være logget ind ville lukke den dør.
 *
 * Til gengæld er alt andet spærret af, for et offentligt endpoint der
 * sender mail er et oplagt mål:
 *
 *   - honeypot: feltet er usynligt, så indhold i det er altid en bot
 *   - længdegrænser: ingen kan sende en roman ind i vores indbakke
 *   - hastighedsloft: 5 beskeder i timen pr. IP
 *   - HTML escapes i skabelonen, så beskeden ikke kan injicere markup
 */

/**
 * Skal matche HONEYPOT_FIELD i ContactForm.tsx.
 *
 * Hed "website" indtil 2026-09-01. Browserens autofyld og adgangskode-
 * managere genkender det navn som URL-feltet på et login og udfylder det af
 * sig selv — og en udløst fælde svarer "sendt" uden at sende noget. Navnet
 * skal være et ingen autofyld-heuristik kender.
 */
const HONEYPOT = "kontakt_ref";

const LIMITS = {
  name: 100,
  company: 100,
  email: 254,
  subject: 200,
  message: 5000,
} as const;

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Ugyldig forespørgsel" }, { status: 405 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: "Beskeden kunne ikke læses. Genindlæs siden og prøv igen." },
        { status: 400 },
      );
    }

    // Botten skal tro den slap igennem. Svarer vi med en fejl, kan den se
    // at fælden findes og prøve igen uden at udfylde feltet.
    //
    // Logges, fordi det er den ene udgang hvor beskeden forsvinder uden at
    // nogen kan se det. Bliver linjen her hyppig, er fælden gået i gang med
    // at fange mennesker frem for bots.
    if (text(body[HONEYPOT]) !== "") {
      console.warn("send-contact: honeypot udløst, beskeden droppes");
      return Response.json({ sent: true });
    }

    const name = text(body.name);
    const company = text(body.company);
    const email = text(body.email).toLowerCase();
    const subject = text(body.subject);
    const message = text(body.message);

    const problem = validate({ name, company, email, subject, message });
    if (problem) {
      return Response.json({ error: problem }, { status: 400 });
    }

    // Hashet, ikke IP'en selv — se migrationen for begrundelsen.
    const allowed = await withinRateLimit(ctx.supabaseAdmin, req);
    if (!allowed) {
      return Response.json(
        {
          error:
            "Du har sendt flere beskeder på kort tid. Vent en time, eller skriv direkte til kontakt@ejendelsregisteret.dk.",
        },
        { status: 429 },
      );
    }

    const result = await contactMessage({
      name,
      company: company || null,
      email,
      subject,
      message,
    });

    // sendEmail kaster aldrig, så fejlen skal aflæses på svaret. Her SKAL
    // den give en fejl til brugeren: siger vi "tak for din besked" uden at
    // beskeden nåede frem, sidder folk og venter på et svar der ikke kommer.
    if (!result.ok) {
      console.error("send-contact: afsendelse fejlede:", result.error);
      return Response.json(
        {
          error:
            "Beskeden kunne ikke sendes lige nu. Prøv igen om lidt, eller skriv direkte til kontakt@ejendelsregisteret.dk.",
        },
        { status: 502 },
      );
    }

    return Response.json({ sent: true });
  }),
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Første fejl i klartekst, eller null hvis alt er i orden. */
function validate(input: {
  name: string;
  company: string;
  email: string;
  subject: string;
  message: string;
}): string | null {
  if (input.name.length < 2) return "Skriv dit navn.";
  if (input.name.length > LIMITS.name) return "Navnet er for langt.";
  if (input.company.length > LIMITS.company)
    return "Virksomhedsnavnet er for langt.";

  // Bevidst løs: en streng regex afviser gyldige adresser, og adressen
  // bliver alligevel afprøvet i det øjeblik vi svarer på beskeden.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      input.email.length > LIMITS.email) {
    return "Tjek at din e-mail er skrevet rigtigt.";
  }

  if (input.subject.length < 2) return "Skriv hvad det handler om.";
  if (input.subject.length > LIMITS.subject) return "Emnet er for langt.";
  if (input.message.length < 10)
    return "Skriv lidt mere, så vi kan hjælpe dig ordentligt.";
  if (input.message.length > LIMITS.message)
    return `Beskeden må højst fylde ${LIMITS.message} tegn.`;

  return null;
}

/** 5 beskeder i timen pr. IP. Fejler opslaget, lukker vi igennem. */
async function withinRateLimit(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  req: Request,
): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "ukendt";

  const salt = Deno.env.get("CRON_SECRET") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${ip}`),
  );
  const hashed = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await admin.rpc("check_contact_rate", {
    hashed_ip: hashed,
  });

  // Er databasen nede, er det bedre at tage imod beskeden end at afvise en
  // rigtig henvendelse. Loftet beskytter mod misbrug, ikke mod nedbrud.
  if (error) {
    console.error("send-contact: hastighedsloft kunne ikke tjekkes:", error);
    return true;
  }

  return data !== false;
}
