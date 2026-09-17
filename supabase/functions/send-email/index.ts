import { withSupabase } from "npm:@supabase/server";
import type { SupabaseClient } from "npm:@supabase/supabase-js";

import {
  accountCreated,
  checkoutAbandoned,
  firstItem,
  itemLimitReached,
  noItemsYet,
} from "../_shared/mails.ts";
import { getStripe } from "../_shared/config.ts";
import { getRecipient } from "../_shared/recipient.ts";

/**
 * Ét sted at sende de mails der ikke udløses af Stripe.
 *
 * Kaldes fra to slags afsendere, begge med X-Cron-Secret:
 *
 *   - databasetriggeren on_item_created, som via pg_net poster
 *     {kind, user_id} når en ejendel oprettes
 *   - cronjobbet der finder aktive medlemmer uden ejendele
 *
 * Den er bevidst ikke åben for brugere. Kunne klienten kalde den med et
 * vilkårligt user_id, kunne enhver spamme enhver anden medlems indbakke.
 *
 * Hver mailtype skrives i email_log med en UNIQUE(user_id, kind), så
 * "din første ejendel" bliver ved med at være den første — også hvis
 * triggeren fyrer igen efter en sletning og en ny oprettelse.
 *
 * `kind` er den værdi der står i email_log og i triggerens payload. De er
 * bevidst stavet på dansk uden æøå, fordi de også optræder som data i
 * databasen — de er nøgler, ikke variabelnavne.
 */

/**
 * Stykprisen pr. ekstra ejendel, hvis Stripe ikke kan spørges.
 *
 * Kun en nødløsning — se extraItemPrice() nedenfor, som læser den pris
 * kunden faktisk faktureres efter. Skal matche extraItemPrice i
 * lib/plans.ts; edge-koden kan ikke importere derfra, da Next og Deno er
 * hver sin runtime.
 */
const EXTRA_ITEM_PRICE_FALLBACK = { private: 2, business: 5 } as const;

/** De typer der kun må sendes én gang pr. bruger. */
const ONCE_ONLY = new Set([
  "oprettet",
  "foerste_ejendel",
  "graense_naaet",
  "ingen_ejendel_endnu",
  "betaling_ikke_fuldfoert",
]);

/** Service role-klienten fra ctx — omgår RLS. */
type Admin = SupabaseClient;

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const expected = Deno.env.get("CRON_SECRET");
    if (!expected || req.headers.get("X-Cron-Secret") !== expected) {
      return Response.json({ error: "Ikke autoriseret" }, { status: 401 });
    }

    let body: { kind?: unknown; user_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
    }

    const kind = typeof body.kind === "string" ? body.kind : null;
    const userId = typeof body.user_id === "string" ? body.user_id : null;

    if (!kind || !userId) {
      return Response.json(
        { error: "kind og user_id er påkrævet" },
        { status: 400 },
      );
    }

    const admin = ctx.supabaseAdmin;

    // Er den allerede sendt, svarer vi 200 og ikke en fejl. Triggeren og
    // cronjobbet skal kunne fyre igen uden at det ser ud som et nedbrud.
    if (ONCE_ONLY.has(kind) && (await alreadySent(admin, userId, kind))) {
      return Response.json({ skipped: "allerede sendt" });
    }

    const recipient = await getRecipient(admin, userId);
    if (!recipient) {
      return Response.json({ error: "Bruger ikke fundet" }, { status: 404 });
    }

    const handled = await dispatch(admin, kind, userId, recipient);
    if (!handled) {
      return Response.json({ error: `Ukendt type: ${kind}` }, { status: 400 });
    }

    if (ONCE_ONLY.has(kind)) {
      await admin.from("email_log").insert({ user_id: userId, kind });
    }

    return Response.json({ sent: kind });
  }),
};

/** Vælger og sender skabelonen. False betyder ukendt type. */
async function dispatch(
  admin: Admin,
  kind: string,
  userId: string,
  recipient: { email: string; name: string | null },
): Promise<boolean> {
  switch (kind) {
    case "oprettet":
      await accountCreated(recipient.email, recipient.name);
      return true;

    case "foerste_ejendel":
      // Navnet på ejendelen står ikke i triggerens payload — den sender kun
      // user_id, så payloaden ikke skal ændres hver gang items får en kolonne.
      await firstItem(recipient.email, await latestItemName(admin, userId));
      return true;

    case "graense_naaet":
      await itemLimitReached(
        recipient.email,
        await includedItems(admin, userId),
        await extraItemPrice(admin, userId),
      );
      return true;

    case "ingen_ejendel_endnu":
      await noItemsYet(recipient.email, recipient.name);
      return true;

    // Kun én gang pr. bruger, håndhævet af UNIQUE(user_id, kind) i
    // email_log. En påmindelse om en betaling man bevidst har fortrudt
    // bliver til spam anden gang den lander.
    case "betaling_ikke_fuldfoert":
      await checkoutAbandoned(recipient.email, recipient.name);
      return true;

    default:
      return false;
  }
}

/**
 * Hvor mange ejendele kundens abonnement inkluderer.
 *
 * Læses fra abonnementet frem for at stå som et tal i koden. Det er samme
 * kilde som databasetriggeren tæller op imod, så mailen kan ikke komme til
 * at sige "dine 5 inkluderede" til en kunde der har ti — og et prisskift
 * behøver ikke en ny deploy af denne funktion.
 *
 * Falder tilbage på kolonnens standardværdi hvis rækken mangler, præcis som
 * triggeren gør.
 */
async function includedItems(admin: Admin, userId: string): Promise<number> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("included_items")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("send-email: kunne ikke læse included_items:", error);
  }

  return data?.included_items ?? 5;
}

/**
 * Hvad kunden betaler pr. ejendel ud over de inkluderede, i kroner.
 *
 * Læst fra kundens egen pris i Stripe: det andet trin i den graduerede
 * pris er stykprisen. Privat og erhverv har ikke længere samme pris, og en
 * kunde der tegnede før en prisændring faktureres stadig efter sin gamle
 * pris. Et fast tal i koden ville skrive det forkerte beløb i mailen til
 * mindst én af dem.
 *
 * Kan Stripe ikke nås, bruges planens nuværende pris ud fra kontotypen.
 * Den kan være forkert for en ældre kunde, men en mail med et omtrent
 * rigtigt beløb er bedre end ingen mail.
 */
async function extraItemPrice(admin: Admin, userId: string): Promise<number> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (sub?.stripe_subscription_id) {
    try {
      const abonnement = await getStripe().subscriptions.retrieve(
        sub.stripe_subscription_id,
        { expand: ["items.data.price.tiers"] },
      );
      const tiered = abonnement.items.data.find(
        (item) => item.price.billing_scheme === "tiered",
      );
      const trin = tiered?.price.tiers?.[1];
      const oere =
        trin?.unit_amount ??
        (trin?.unit_amount_decimal ? Number(trin.unit_amount_decimal) : null);

      if (typeof oere === "number" && Number.isFinite(oere)) {
        return oere / 100;
      }
    } catch (caught) {
      console.error("send-email: kunne ikke læse stykprisen i Stripe:", caught);
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("account_type")
    .eq("user_id", userId)
    .maybeSingle();

  return profile?.account_type === "business"
    ? EXTRA_ITEM_PRICE_FALLBACK.business
    : EXTRA_ITEM_PRICE_FALLBACK.private;
}

/** Er mailtypen allerede sendt til brugeren? */
async function alreadySent(
  admin: Admin,
  userId: string,
  kind: string,
): Promise<boolean> {
  const { data } = await admin
    .from("email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();

  return Boolean(data);
}

/** Navnet på den ejendel der lige er oprettet. Falder tilbage på noget neutralt. */
async function latestItemName(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from("items")
    .select("name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.name ?? "Din ejendel";
}
