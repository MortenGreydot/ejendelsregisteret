import { withSupabase } from "npm:@supabase/server";
import type { SupabaseClient } from "npm:@supabase/supabase-js";
import type Stripe from "npm:stripe";

import {
  membershipActive,
  paymentFailed,
  receipt,
} from "../_shared/mails.ts";
import { getRecipient } from "../_shared/recipient.ts";
import {
  mapStatus,
  setupPriceIds,
  getStripe,
  toIso,
  toKroner,
} from "../_shared/config.ts";

/** Service role-klienten fra ctx — omgår RLS, bruges kun her. */
type Admin = SupabaseClient;

/**
 * Modtager Stripe-events. Kræver `verify_jwt = false` i config.toml — Stripe
 * sender ingen Supabase-JWT. Til gengæld er signaturkontrollen nedenfor det
 * eneste der skiller ægte events fra en vilkårlig POST, så den må aldrig
 * springes over.
 */
export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const signature = req.headers.get("stripe-signature");
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !secret) {
      return new Response("Manglende signatur", { status: 400 });
    }

    // Rå body — parses den først, ændres bytes og signaturen fejler.
    const body = await req.text();

    let event: Stripe.Event;
    try {
      // Async-varianten: Deno bruger WebCrypto, som kun findes asynkront.
      event = await getStripe().webhooks.constructEventAsync(
        body,
        signature,
        secret,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "ukendt fejl";
      return new Response(`Ugyldig signatur: ${message}`, { status: 400 });
    }

    const admin = ctx.supabaseAdmin;

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await onCheckoutCompleted(admin, event.data.object);
          break;

        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await onSubscriptionChanged(admin, event.data.object);
          break;

        case "invoice.paid":
          await onInvoicePaid(admin, event.data.object);
          break;

        case "invoice.payment_failed":
          await onInvoiceFailed(admin, event.data.object);
          break;
      }
    } catch (error) {
      // 500 får Stripe til at prøve igen. Log før vi giver op.
      console.error(`Fejl i ${event.type}:`, error);
      return new Response("Intern fejl", { status: 500 });
    }

    return Response.json({ received: true });
  }),
};

/** Aktiverer abonnementet, når betalingen er gennemført. */
async function onCheckoutCompleted(
  admin: Admin,
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.user_id;
  if (!userId || !session.subscription) return;

  const subscription = await getStripe().subscriptions.retrieve(
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id,
    { expand: ["items.data.price.tiers"] },
  );

  await admin
    .from("subscriptions")
    .update({
      status: mapStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      stripe_customer_id: String(subscription.customer),
      monthly_price: monthlyPriceOf(subscription),
      activated_at: new Date().toISOString(),
      current_period_start: periodOf(subscription).start,
      current_period_end: periodOf(subscription).end,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  const recipient = await getRecipient(admin, userId);
  if (recipient) await membershipActive(recipient.email, recipient.name);
}

/** Statusskift: forny, opsig, betalingsproblemer. */
async function onSubscriptionChanged(
  admin: Admin,
  subscription: Stripe.Subscription,
) {
  await admin
    .from("subscriptions")
    .update({
      status: mapStatus(subscription.status),
      // monthly_price sættes bevidst ikke her: eventets payload har ikke
      // tiers udfoldet, så den ville blive nulstillet ved hvert statusskift.
      current_period_start: periodOf(subscription).start,
      current_period_end: periodOf(subscription).end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

/** Gemmer betalingerne — én række pr. fakturalinje, så typerne kan skelnes. */
async function onInvoicePaid(admin: Admin, invoice: Stripe.Invoice) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_customer_id", String(invoice.customer))
    .maybeSingle();

  if (!sub) return;

  const setupPrices = setupPriceIds();

  const rows = invoice.lines.data.map((line) => ({
    user_id: sub.user_id,
    subscription_id: sub.id,
    // Gemmes på hver betaling, ikke kun på abonnementet. Sletter brugeren
    // sin konto, sættes user_id til null og abonnementsrækken forsvinder —
    // uden kundenummeret her ville betalingen ikke kunne henføres til noget,
    // og så ville den være ubrugelig som regnskabsmateriale.
    stripe_customer_id: String(invoice.customer),
    payment_type: classifyLine(line, setupPrices),
    amount: toKroner(line.amount),
    currency: invoice.currency.toUpperCase(),
    status: "paid" as const,
    stripe_payment_intent_id:
      typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : (invoice.payment_intent?.id ?? null),
    stripe_invoice_id: invoice.id,
    paid_at: toIso(invoice.status_transitions?.paid_at),
  }));

  if (rows.length > 0) {
    await admin.from("payments").insert(rows);
  }

  await recordBillingUsage(admin, invoice, sub.user_id);

  const recipient = await getRecipient(admin, sub.user_id);
  if (recipient) {
    await receipt(
      recipient.email,
      toKroner(invoice.amount_paid),
      invoice.number,
      invoice.billing_reason === "subscription_create",
    );
  }
}

/**
 * Bogfører hvad Stripe rent faktisk opkrævede.
 *
 * Tallene udledes af fakturaens linjer frem for at blive regnet ud på ny:
 * en graduated pris deler sig i én linje pr. tier, hvor tier 1 er de
 * inkluderede ejendele og tier 2 er dem derudover. Summen af linjernes
 * quantity er kundens antal ejendele.
 *
 * Beregnede vi det selv, kunne rækken komme til at afvige fra fakturaen —
 * og så ville revisionssporet være værdiløst netop når det skulle bruges.
 */
async function recordBillingUsage(
  admin: Admin,
  invoice: Stripe.Invoice,
  userId: string,
) {
  const setupPrices = setupPriceIds();

  let itemCount = 0;
  let extraItems = 0;
  let extraAmount = 0;
  let periodStart: number | null = null;
  let periodEnd: number | null = null;

  for (const line of invoice.lines.data) {
    const kind = classifyLine(line, setupPrices);
    if (kind === "setup_fee") continue;

    const period = (
      line as unknown as { period?: { start?: number; end?: number } }
    ).period;
    periodStart ??= period?.start ?? null;
    periodEnd ??= period?.end ?? null;

    // Kun stykpris-linjer repræsenterer ejendele. Det faste månedsgebyr
    // har også en quantity, og den ville ellers blive talt med som en
    // ekstra ejendel.
    if (unitAmountOf(line) === null) continue;

    itemCount += line.quantity ?? 0;

    if (kind === "extra_items") {
      extraItems += line.quantity ?? 0;
      extraAmount += toKroner(line.amount);
    }
  }

  // Ingen abonnementslinjer — fx en faktura der kun dækker oprettelsesgebyret.
  if (periodStart === null) return;

  const billingMonth =
    new Date(periodStart * 1000).toISOString().slice(0, 8) + "01";

  // Nøglen er fakturaen, ikke måneden: to fakturaer kan falde i samme
  // kalendermåned (fx en proration og en almindelig fornyelse), og med
  // måneden som nøgle overskrev den ene den anden i stilhed.
  await admin.from("billing_usage").upsert(
    {
      user_id: userId,
      billing_month: billingMonth,
      period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      item_count: itemCount,
      included_items: itemCount - extraItems,
      extra_items: extraItems,
      extra_amount: extraAmount,
      stripe_invoice_id: invoice.id,
    },
    { onConflict: "stripe_invoice_id" },
  );
}

async function onInvoiceFailed(admin: Admin, invoice: Stripe.Invoice) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("stripe_customer_id", String(invoice.customer))
    .maybeSingle();

  await admin
    .from("subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", String(invoice.customer));

  // payments.status har `failed` i sin CHECK-constraint, men uden det her
  // blev der aldrig skrevet andet end `paid`. Så kunne man ikke se forskel
  // på "har aldrig betalt" og "betalingen mislykkedes".
  if (!sub) return;

  const recipient = await getRecipient(admin, sub.user_id);
  if (recipient) await paymentFailed(recipient.email);

  await admin.from("payments").insert({
    user_id: sub.user_id,
    subscription_id: sub.id,
    stripe_customer_id: String(invoice.customer),
    payment_type: "subscription",
    amount: toKroner(invoice.amount_due),
    currency: invoice.currency.toUpperCase(),
    status: "failed",
    stripe_invoice_id: invoice.id,
  });
}

/**
 * Pris-id'et på en fakturalinje ligger i pricing.price_details.price.
 * Det gamle `line.price` findes ikke længere på nyere API-versioner og er
 * altid undefined — læses det, ender alle linjer som "subscription".
 */
function priceIdOf(line: Stripe.InvoiceLineItem): string | null {
  const pricing = (
    line as unknown as {
      pricing?: { price_details?: { price?: string } };
    }
  ).pricing;
  return pricing?.price_details?.price ?? null;
}

function classifyLine(
  line: Stripe.InvoiceLineItem,
  setupPrices: string[],
): "setup_fee" | "subscription" | "extra_items" {
  const priceId = priceIdOf(line);
  // Privat og erhverv har hvert sit oprettelsesgebyr i Stripe.
  if (priceId && setupPrices.includes(priceId)) return "setup_fee";

  // En graduated pris udsender flere linjer: et fast gebyr uden stykpris,
  // og én stykpris-linje pr. tier. Tier 1's stykpris er 0 kr., så den må
  // IKKE tælle som ekstra — kun linjer med en stykpris over nul.
  //
  // Bemærk sammenligningen: unit_amount_decimal er en streng, og "0" er
  // sand i JavaScript. Der skal konverteres til tal.
  const unit = unitAmountOf(line);
  if (unit !== null && unit > 0) return "extra_items";

  return "subscription";
}

/** Stykprisen i øre, eller null hvis linjen er et fast gebyr. */
function unitAmountOf(line: Stripe.InvoiceLineItem): number | null {
  const raw = (
    line as unknown as { pricing?: { unit_amount_decimal?: string | null } }
  ).pricing?.unit_amount_decimal;
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Faktureringsperioden.
 *
 * current_period_start/end lå tidligere på selve abonnementet, men er
 * flyttet ned på abonnementslinjerne. Læses de på Subscription-objektet,
 * er de undefined, og der gemmes null i databasen.
 */
function periodOf(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = subscription.items.data[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    start: toIso(item?.current_period_start),
    end: toIso(item?.current_period_end),
  };
}

/**
 * Grundprisen pr. måned. På en graduated tiered pris er unit_amount null —
 * beløbet står som flat_amount på første tier. Læses unit_amount alene,
 * gemmes der 0 i databasen.
 *
 * Kræver at abonnementet er hentet med expand: ["items.data.price.tiers"].
 */
function monthlyPriceOf(subscription: Stripe.Subscription): number | null {
  const recurring = subscription.items.data.find(
    (item) => item.price.recurring !== null,
  );
  if (!recurring) return null;

  if (recurring.price.unit_amount !== null) {
    return toKroner(recurring.price.unit_amount);
  }

  const firstTier = recurring.price.tiers?.[0];
  if (firstTier?.flat_amount != null) return toKroner(firstTier.flat_amount);
  if (firstTier?.unit_amount != null) return toKroner(firstTier.unit_amount);

  // Ukendt prisform — hellere lade feltet stå end skrive et forkert 0.
  return null;
}
