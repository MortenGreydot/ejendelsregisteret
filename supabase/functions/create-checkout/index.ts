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
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // userClaims er {id, role, email, appMetadata, userMetadata} — ikke
    // JWT'ets rå claims. Bruger-id'et hedder `id`, ikke `sub`.
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "Ikke logget ind" }, { status: 401 });
    }

    let planId: unknown;
    let cancelTo: unknown;
    try {
      ({ planId, cancelTo } = await req.json());
    } catch {
      return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
    }

    if (!isPlanId(planId)) {
      return Response.json({ error: "Ukendt plan" }, { status: 400 });
    }

    // RLS-scopet klient: brugeren kan kun se sin egen række.
    const { data: existing, error: readError } = await ctx.supabase
      .from("subscriptions")
      .select("status, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (readError) {
      return Response.json({ error: readError.message }, { status: 500 });
    }

    if (existing?.status === "active") {
      return Response.json(
        { error: "Du har allerede et aktivt abonnement" },
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
      return Response.json({ error: upsertError.message }, { status: 500 });
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
      const message = error instanceof Error ? error.message : String(error);
      console.error("create-checkout:", message);
      return Response.json({ error: message }, { status: 500 });
    }
  }),
};
