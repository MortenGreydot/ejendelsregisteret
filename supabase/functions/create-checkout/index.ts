import { withSupabase } from "npm:@supabase/server";

import {
  ACCOUNT_TYPE,
  isPlanId,
  setupPriceId,
  siteUrl,
  getStripe,
  subscriptionPriceId,
} from "../_shared/config.ts";

/**
 * Opretter en Stripe Checkout Session i subscription-mode med to line items:
 * det månedlige abonnement og engangsgebyret på 99 kr., som Stripe lægger på
 * første faktura.
 *
 * Selve aktiveringen sker IKKE her — den sker i stripe-webhook, når Stripe
 * bekræfter betalingen. Brugeren kan lukke browseren midt i checkout, så
 * svaret herfra er ikke bevis på at der er betalt.
 */
/** Tilladte returstier. Ukendt værdi falder tilbage til prissiden. */
const CANCEL_PATHS: Record<string, string> = {
  priser: "/priser",
  "min-side": "/min-side",
  "bliv-medlem": "/bliv-medlem",
};

function cancelPath(value: unknown): string {
  return typeof value === "string" && value in CANCEL_PATHS
    ? CANCEL_PATHS[value]
    : "/priser";
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    try {
    if (req.method !== "POST") {
      return Response.json({ error: "Ugyldig forespørgsel" }, { status: 405 });
    }

    // userClaims er {id, role, email, appMetadata, userMetadata} — ikke
    // JWT'ets rå claims. Bruger-id'et hedder `id`, ikke `sub`.
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    let planId: unknown;
    let cancelTo: unknown;
    try {
      ({ planId, cancelTo } = await req.json());
    } catch {
      return Response.json(
        { error: "Forespørgslen kunne ikke læses. Genindlæs siden og prøv igen." },
        { status: 400 },
      );
    }

    if (!isPlanId(planId)) {
      return Response.json(
        { error: "Vælg om du vil have privat eller erhverv." },
        { status: 400 },
      );
    }

    // RLS-scopet klient: brugeren kan kun se sin egen række.
    const { data: existing, error: readError } = await ctx.supabase
      .from("subscriptions")
      .select("status, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) {
      console.error("create-checkout: kunne ikke læse abonnement:", readError);
      return Response.json(
        { error: "Vi kunne ikke hente dit medlemskab. Prøv igen om lidt." },
        { status: 500 },
      );
    }

    if (existing?.status === "active") {
      return Response.json(
        { error: "Du har allerede et aktivt medlemskab." },
        { status: 409 },
      );
    }

    // Genbrug Stripe-kunden, så en afbrudt checkout ikke skaber dubletter.
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: ctx.userClaims?.email,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        // Graduated tiers aflæser quantity. 1 = tier 1 (29 kr.);
        // report-usage hæver den til kundens faktiske antal ejendele.
        { price: subscriptionPriceId(planId), quantity: 1 },
        { price: setupPriceId(planId), quantity: 1 },
      ],
      // Viser feltet "Tilføj kampagnekode" i Checkout. Hører til på selve
      // sessionen — subscription_data kender ikke parameteren og afviser den.
      //
      // Bemærk at allow_promotion_codes og discounts udelukker hinanden:
      // skal en rabat gives automatisk (fx efter verificeret studiekort),
      // sendes den som `discounts` i stedet, og så skal denne linje væk.
      allow_promotion_codes: true,
      // Findes på både session og subscription, så webhooken kan slå
      // brugeren op uanset hvilket event der lander først.
      metadata: { user_id: userId, plan_id: planId },
      subscription_data: {
        metadata: { user_id: userId, plan_id: planId },
      },
      // ?checkout=ok udløser onboarding-guiden på Min side. Markøren
      // findes kun i denne ene viderestilling, så guiden vises præcis én
      // gang — ikke ved hvert besøg.
      success_url: `${siteUrl()}/min-side?checkout=ok`,
      // Brugeren skal tilbage hvor de kom fra. Stien slås op i en hvidliste
      // og bygges ALDRIG af klientens tekst — ellers ville feltet være en
      // åben viderestilling, hvor et link fra os kunne sende folk hvorhen
      // som helst.
      cancel_url: `${siteUrl()}${cancelPath(cancelTo)}?checkout=afbrudt`,
    });

    // Reserver rækken, så vi kender kunden hvis brugeren falder fra.
    // monthly_price sættes bevidst ikke her — webhooken læser det faktiske
    // beløb fra Stripe, så prisen kun findes ét sted.
    const { error: upsertError } = await ctx.supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          status: existing?.status ?? "pending_activation",
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("create-checkout: kunne ikke gemme abonnement:", upsertError);
      return Response.json(
        { error: "Betalingen kunne ikke forberedes. Prøv igen om lidt." },
        { status: 500 },
      );
    }

    // Kontotypen følger den valgte plan. Upsert frem for update: mangler
    // profilrækken (bruger oprettet før triggeren fandtes), ville et update
    // ramme nul rækker og fejle stille.
    await ctx.supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, account_type: ACCOUNT_TYPE[planId] },
        { onConflict: "user_id" },
      );

    return Response.json({ url: session.url });
    } catch (error) {
      // Uden dette bliver enhver kastet fejl til "non-2xx status code"
      // hos klienten, uden nogen antydning af hvad der gik galt.
      // Beskeden kommer typisk fra Stripe og er engelsk og teknisk. Den
      // hører hjemme i loggen, ikke i brugerfladen.
      const message = error instanceof Error ? error.message : String(error);
      console.error("create-checkout:", message);
      return Response.json(
        {
          error:
            "Betalingen kunne ikke startes lige nu. Prøv igen om et øjeblik, og skriv til os hvis det bliver ved.",
        },
        { status: 500 },
      );
    }
  }),
};
