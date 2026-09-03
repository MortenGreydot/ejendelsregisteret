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

    // Et afsluttet abonnement kan ikke genoplives. Stripe afviser at sætte
    // cancel_at_period_end på et abonnement der allerede er slut, og fejlen
    // derfra er engelsk og teknisk. Bedre at sige det selv, og sige hvad
    // kunden så skal gøre.
    //
    // Brugerfladen viser normalt slet ikke genoptag-knappen så sent, men
    // knappen i opsigelsesmailen kan klikkes hvornår som helst — også en
    // måned efter medlemskabet stoppede.
    if (
      action === "resume" &&
      (sub.status === "canceled" || sub.status === "expired")
    ) {
      return Response.json(
        {
          error:
            "Dit medlemskab er allerede udløbet og kan ikke genoptages. Tegn et nyt for at fortsætte.",
        },
        { status: 409 },
      );
    }

    // Opsigelse sker ved periodens udløb, ikke straks — brugeren har betalt
    // for perioden, og FAQ'en på prissiden lover netop det.
    //
    // try/catch af samme grund som i create-checkout: uden det bliver enhver
    // fejl fra Stripe til "non-2xx status code" hos klienten, uden nogen
    // antydning af hvad der gik galt.
    let updated;
    try {
      updated = await getStripe().subscriptions.update(
        sub.stripe_subscription_id,
        { cancel_at_period_end: action === "cancel" },
      );
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught);
      console.error(`manage-subscription: Stripe afviste ${action}:`, detail);
      return Response.json(
        {
          error:
            action === "cancel"
              ? "Opsigelsen kunne ikke gennemføres lige nu. Prøv igen om lidt, eller skriv til kontakt@ejendelsregisteret.dk."
              : "Medlemskabet kunne ikke genoptages lige nu. Prøv igen om lidt, eller skriv til kontakt@ejendelsregisteret.dk.",
        },
        { status: 502 },
      );
    }

    // status opdateres af webhooken; her gemmes kun det brugeren lige valgte.
    // Perioden ligger på abonnementslinjen, ikke på abonnementet.
    const item = updated.items.data[0] as unknown as {
      current_period_end?: number;
    };

    // Skrives med det samme frem for at vente på webhooken. Brugeren
    // genindlæser Min side i samme sekund som de trykker, og skal se
    // resultatet af deres eget klik — ikke siden som den så ud før.
    // Webhooken skriver den samme værdi igen bagefter; det gør intet.
    const { error: markError } = await ctx.supabaseAdmin
      .from("subscriptions")
      .update({
        cancel_at_period_end: updated.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (markError) {
      console.error("manage-subscription: kunne ikke gemme opsigelsen:", markError);
    }

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
