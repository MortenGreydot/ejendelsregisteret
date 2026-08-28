import { withSupabase } from "npm:@supabase/server";

import { getStripe } from "../_shared/config.ts";

/**
 * Synkroniserer abonnementets quantity med kundens antal ejendele.
 *
 * Medlemskabsprisen er graduated tiered og `licensed` — altså aflæser Stripe
 * abonnementslinjens quantity for at afgøre hvilke tiers der rammes:
 *
 *   tier 1 (1–5):   0 kr./stk. + 29 kr. fast
 *   tier 2 (6–∞):   2 kr./stk.
 *
 * Har kunden 8 ejendele, sættes quantity til 8, og Stripe fakturerer
 * 29 + 3 × 2 = 35 kr. Fribundgrænsen på 5 findes dermed kun i Stripe.
 *
 * Minimum 1: en licensed linje kan ikke have quantity 0, og en kunde uden
 * ejendele skal stadig betale de 29 kr. fra tier 1.
 *
 * `proration_behavior: "none"` er afgørende. Uden den udsteder Stripe en
 * forholdsmæssig ekstraregning hver gang tallet ændrer sig midt i perioden.
 * Med den slår det nye antal først igennem på næste faktura.
 *
 * Den bogfører ikke længere i billing_usage — det gør webhooken på
 * invoice.paid ud fra den faktiske faktura, så tallene ikke kan afvige.
 *
 * Den behandler ALLE aktive abonnementer hver kørsel, ikke kun dem der
 * står til fornyelse. Quantity er en tilstand, ikke en hændelse, så det
 * er hverken dyrere eller farligere at sætte den samme værdi igen.
 *
 * Kør den som cron én gang i døgnet. Adgang via X-Cron-Secret.
 */
export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const expected = Deno.env.get("CRON_SECRET");
    if (!expected || req.headers.get("X-Cron-Secret") !== expected) {
      return Response.json({ error: "Ikke autoriseret" }, { status: 401 });
    }

    const admin = ctx.supabaseAdmin;
    const stripe = getStripe();

    const { data: subs, error } = await admin
      .from("subscriptions")
      .select("user_id, stripe_subscription_id, current_period_end")
      .eq("status", "active")
      .not("stripe_subscription_id", "is", null);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const results: { user_id: string; items: number; quantity: number }[] = [];

    for (const sub of subs ?? []) {
      const { count } = await admin
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", sub.user_id);

      const itemCount = count ?? 0;
      const quantity = Math.max(1, itemCount);

      const subscription = await stripe.subscriptions.retrieve(
        sub.stripe_subscription_id,
      );

      // Efter checkout har abonnementet kun én tilbagevendende linje —
      // engangsgebyret er ikke en abonnementslinje.
      const item =
        subscription.items.data.find(
          (i) => i.price.billing_scheme === "tiered",
        ) ?? subscription.items.data[0];

      if (!item) continue;

      if (item.quantity !== quantity) {
        await stripe.subscriptionItems.update(item.id, {
          quantity,
          proration_behavior: "none",
        });
      }

      results.push({ user_id: sub.user_id, items: itemCount, quantity });
    }

    return Response.json({ synced: results.length, results });
  }),
};
