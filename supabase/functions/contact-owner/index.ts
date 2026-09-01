import { withSupabase } from "npm:@supabase/server";
import type { SupabaseClient } from "npm:@supabase/supabase-js";

import {
  ownerContactCopy,
  ownerContacted,
  type ContactRequest,
} from "../_shared/mails.ts";
import { getRecipient } from "../_shared/recipient.ts";

/**
 * Sender en besked fra en finder videre til ejeren af en ejendel.
 *
 * Kontakten går gennem os. Finderen får aldrig ejerens mail, og ejeren får
 * aldrig finderens — de to mails er derfor forskellige, og svar fra begge
 * sider lander i vores egen indbakke.
 *
 * Åben uden login, ligesom selve opslaget: den der har fundet en cykel har
 * ikke en konto hos os, og skal ikke tvinges til at oprette en for at give
 * besked. Misbrug holdes nede af de samme fire lag som kontaktformularen:
 * honeypot, længdegrænser, hastighedsloft og HTML-escaping.
 *
 * Endpointet svarer ens uanset om ejendelen findes eller ej. Ellers kunne
 * man bruge det til at afprøve om et vilkårligt item-id eksisterer.
 */

/** Skal matche HONEYPOT i ContactOwner.tsx. */
const HONEYPOT = "website";

const LIMITS = {
  name: 100,
  email: 254,
  phone: 40,
  message: 3000,
} as const;

/** Færre end kontaktformularen: her rammer beskeden en anden borgers indbakke. */
const MAX_PER_HOUR = 3;

type Admin = SupabaseClient;

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

    // Botten skal tro den slap igennem, så den ikke opdager fælden.
    if (text(body[HONEYPOT]) !== "") {
      return Response.json({ sent: true });
    }

    const itemId = text(body.itemId);
    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const phone = text(body.phone);
    const message = text(body.message);

    const problem = validate({ name, email, phone, message });
    if (problem) {
      return Response.json({ error: problem }, { status: 400 });
    }

    if (!/^[0-9a-f-]{36}$/i.test(itemId)) {
      return Response.json(
        { error: "Vi kunne ikke finde ejendelen. Slå serienummeret op igen." },
        { status: 400 },
      );
    }

    const admin = ctx.supabaseAdmin;

    if (!(await withinRateLimit(admin, req))) {
      return Response.json(
        {
          error:
            "Du har sendt flere beskeder på kort tid. Vent en time, eller skriv til kontakt@ejendelsregisteret.dk.",
        },
        { status: 429 },
      );
    }

    const { data: item } = await admin
      .from("items")
      .select("id, name, status, user_id")
      .eq("id", itemId)
      .maybeSingle();

    // Findes ejendelen ikke, svarer vi som om alt gik godt. Et ærligt svar
    // ville gøre endpointet til et værktøj til at afprøve item-id'er.
    if (!item) {
      console.warn("contact-owner: ukendt ejendel:", itemId);
      return Response.json({ sent: true });
    }

    const owner = item.user_id ? await getRecipient(admin, item.user_id) : null;

    const request: ContactRequest = {
      finderName: name,
      finderEmail: email,
      finderPhone: phone || null,
      message,
      itemName: item.name,
      itemStatus: item.status,
    };

    // Gemmes før afsendelsen. Fejler mailen, skal henvendelsen stadig
    // findes — så kan vi give den videre i hånden frem for at tabe den.
    const { error: saveError } = await admin.from("contact_requests").insert({
      item_id: item.id,
      owner_id: item.user_id,
      finder_name: name,
      finder_email: email,
      finder_phone: phone || null,
      message,
    });

    if (saveError) {
      console.error("contact-owner: kunne ikke gemme henvendelsen:", saveError);
    }

    // Vores egen kopi først. Den er den vigtigste: kommer ejerens mail ikke
    // frem, kan vi stadig følge op, fordi henvendelsen ligger hos os.
    const copy = await ownerContactCopy({ ...request, itemId: item.id });

    const delivered = owner
      ? await ownerContacted(owner.email, owner.name, request)
      : { ok: false, error: "ejeren har ingen mailadresse" };

    if (!copy.ok && !delivered.ok) {
      console.error("contact-owner: ingen mails kom afsted:", copy.error);
      return Response.json(
        {
          error:
            "Beskeden kunne ikke sendes lige nu. Prøv igen om lidt, eller skriv til kontakt@ejendelsregisteret.dk.",
        },
        { status: 502 },
      );
    }

    // Nåede kopien frem men ikke ejerens mail, er beskeden ikke tabt — vi
    // har den, og kan give den videre manuelt. Finderen skal ikke sendes
    // ud i at skrive den samme besked igen.
    if (!delivered.ok) {
      console.error("contact-owner: ejerens mail fejlede:", delivered.error);
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
  email: string;
  phone: string;
  message: string;
}): string | null {
  if (input.name.length < 2) return "Skriv dit navn, så ejeren ved hvem der skriver.";
  if (input.name.length > LIMITS.name) return "Navnet er for langt.";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      input.email.length > LIMITS.email) {
    return "Tjek at din e-mail er skrevet rigtigt, så vi kan svare dig.";
  }

  if (input.phone.length > LIMITS.phone) return "Telefonnummeret er for langt.";

  if (input.message.length < 10)
    return "Skriv lidt mere om hvad det drejer sig om.";
  if (input.message.length > LIMITS.message)
    return `Beskeden må højst fylde ${LIMITS.message} tegn.`;

  return null;
}

/** Eget loft, adskilt fra kontaktformularens, via præfikset i hashet. */
async function withinRateLimit(admin: Admin, req: Request): Promise<boolean> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "ukendt";

  const salt = Deno.env.get("CRON_SECRET") ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`ejer-kontakt:${salt}:${ip}`),
  );
  const hashed = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data, error } = await admin.rpc("check_contact_rate", {
    hashed_ip: hashed,
    max_per_hour: MAX_PER_HOUR,
  });

  // Er databasen nede, lukker vi igennem. En fundet cykel er vigtigere end
  // et loft der alligevel kun skal stoppe misbrug.
  if (error) {
    console.error("contact-owner: hastighedsloft kunne ikke tjekkes:", error);
    return true;
  }

  return data !== false;
}
