import { withSupabase } from "npm:@supabase/server";

import { getStripe, siteUrl } from "../_shared/config.ts";
import { subscriptionCancelled } from "../_shared/mails.ts";
import { getRecipient } from "../_shared/recipient.ts";

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
      return Response.json({ error: "Ugyldig forespørgsel" }, { status: 405 });
    }

    // userClaims er {id, role, email, appMetadata, userMetadata} — ikke
    // JWT'ets rå claims. Bruger-id'et hedder `id`, ikke `sub`.
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "Du skal være logget ind." }, { status: 401 });
    }

    let action: unknown;
    try {
      ({ action } = await req.json());
    } catch {
      return Response.json(
        { error: "Forespørgslen kunne ikke læses. Genindlæs siden og prøv igen." },
        { status: 400 },
      );
    }

    if (!isAction(action)) {
      return Response.json({ error: "Handlingen kunne ikke genkendes." }, { status: 400 });
    }

    const { data: sub, error } = await ctx.supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("manage-subscription: kunne ikke læse abonnement:", error);
      return Response.json(
        { error: "Vi kunne ikke hente dit medlemskab. Prøv igen om lidt." },
        { status: 500 },
      );
    }

    if (!sub) {
      return Response.json(
        { error: "Du har ikke et medlemskab endnu." },
        { status: 404 },
      );
    }

    // Kundeportalen dækker både betalingsmetode, fakturaer og kvitteringer.
    if (action === "portal") {
      if (!sub.stripe_customer_id) {
        return Response.json(
          { error: "Du har ikke betalt endnu, så der er ingen fakturaer at vise." },
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
        { error: "Dit medlemskab er ikke aktiveret endnu. Færdiggør betalingen først." },
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

    // Kun ved opsigelse. Fortryder man igen, får man ikke en mail om det —
    // handlingen bekræftes på skærmen, og en "du er stadig medlem"-mail
    // ville mest af alt forvirre.
    if (action === "cancel") {
      const recipient = await getRecipient(ctx.supabaseAdmin, userId);
      if (recipient) {
        await subscriptionCancelled(
          recipient.email,
          formatDanishDate(item?.current_period_end),
        );
      }
    }

    return Response.json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ?? null,
    });
  }),
};

/** Dansk dato: unix-sekunder → "14. september 2026". Null hvis Stripe ikke oplyste den. */
function formatDanishDate(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number") return null;

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(seconds * 1000));
}
