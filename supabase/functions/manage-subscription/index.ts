import { withSupabase } from "npm:@supabase/server";

import { getStripe, siteUrl } from "../_shared/config.ts";

type Action = "cancel" | "resume" | "portal";

function isAction(value: unknown): value is Action {
  return value === "cancel" || value === "resume" || value === "portal";
}

/**
 * Brugerens handlinger på et aktivt abonnement.
 *
 * Abonnementet læses gennem den RLS-scopede klient, så en bruger kun kan
 * finde sin egen række. Stripe-id'et kommer derfor fra databasen og aldrig
 * fra request-body — ellers kunne man opsige en fremmeds abonnement ved at
 * gætte et subscription-id.
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // userClaims er {id, role, email, appMetadata, userMetadata} — ikke
    // JWT'ets rå claims. Bruger-id'et hedder `id`, ikke `sub`.
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "Ikke logget ind" }, { status: 401 });
    }

    let action: unknown;
    try {
      ({ action } = await req.json());
    } catch {
      return Response.json({ error: "Ugyldig JSON" }, { status: 400 });
    }

    if (!isAction(action)) {
      return Response.json({ error: "Ukendt handling" }, { status: 400 });
    }

    const { data: sub, error } = await ctx.supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!sub) {
      return Response.json(
        { error: "Intet abonnement fundet" },
        { status: 404 },
      );
    }

    // Kundeportalen dækker både betalingsmetode, fakturaer og kvitteringer.
    if (action === "portal") {
      if (!sub.stripe_customer_id) {
        return Response.json(
          { error: "Ingen Stripe-kunde endnu" },
          { status: 409 },
        );
      }

      const session = await getStripe().billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${siteUrl()}/min-side`,
      });

      return Response.json({ url: session.url });
    }

    if (!sub.stripe_subscription_id) {
      return Response.json(
        { error: "Abonnementet er ikke aktiveret endnu" },
        { status: 409 },
      );
    }

    // Opsigelse sker ved periodens udløb, ikke straks — brugeren har betalt
    // for perioden, og FAQ'en på prissiden lover netop det.
    const updated = await getStripe().subscriptions.update(
      sub.stripe_subscription_id,
      { cancel_at_period_end: action === "cancel" },
    );

    // status opdateres af webhooken; her gemmes kun det brugeren lige valgte.
    // Perioden ligger på abonnementslinjen, ikke på abonnementet.
    const item = updated.items.data[0] as unknown as {
      current_period_end?: number;
    };

    return Response.json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ?? null,
    });
  }),
};
