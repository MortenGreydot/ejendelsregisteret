import Stripe from "npm:stripe";

let cachedStripe: Stripe | null = null;

/**
 * Stripe-klienten oprettes ved første kald, ikke ved import.
 *
 * Kaldes requireEnv på modulniveau, crasher hele funktionen under load, og
 * Supabase svarer med et generisk WORKER_ERROR uden at afsløre hvilken
 * variabel der mangler. Lazy konstruktion flytter fejlen ind i handleren,
 * hvor den kan fanges og returneres som en læsbar besked.
 *
 * Pin gerne apiVersion til den version der står i dit Stripe Dashboard.
 * Udeladt her, så kontoens default bruges frem for et forkert gæt.
 */
export function getStripe(): Stripe {
  if (!cachedStripe) {
    cachedStripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  }
  return cachedStripe;
}

export type PlanId = "privat" | "erhverv";

/** profiles.account_type har CHECK (private, business) — ikke de danske slugs. */
export const ACCOUNT_TYPE: Record<PlanId, "private" | "business"> = {
  privat: "private",
  erhverv: "business",
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "privat" || value === "erhverv";
}

/**
 * Beløbene lever i Stripe, ikke i koden. Klienten sender kun et planId —
 * ellers kunne en bruger ændre prisen i devtools inden checkout oprettes.
 */
export function subscriptionPriceId(planId: PlanId): string {
  return planId === "privat"
    ? requireEnv("STRIPE_PRICE_PRIVAT")
    : requireEnv("STRIPE_PRICE_ERHVERV");
}

/**
 * Engangsgebyret. Lægges på første faktura.
 *
 * Privat og erhverv har hver sit produkt i Stripe, så gebyret slås op pr.
 * plan. Falder erhverv tilbage på privatprisen, ville en erhvervskunde få
 * en faktura der ikke matcher deres eget produkt.
 */
export function setupPriceId(planId: PlanId): string {
  return planId === "privat"
    ? requireEnv("STRIPE_PRICE_SETUP")
    : requireEnv("STRIPE_PRICE_SETUP_ERHVERV");
}

/** Begge oprettelsesgebyrer — webhooken skal kunne genkende dem begge. */
export function setupPriceIds(): string[] {
  return [
    Deno.env.get("STRIPE_PRICE_SETUP"),
    Deno.env.get("STRIPE_PRICE_SETUP_ERHVERV"),
  ].filter((v): v is string => Boolean(v));
}

export function siteUrl(): string {
  return requireEnv("SITE_URL").replace(/\/$/, "");
}

/** Stripe-status → subscriptions.status, som har en CHECK-constraint. */
export function mapStatus(
  stripeStatus: string,
): "pending_activation" | "active" | "past_due" | "canceled" | "expired" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete_expired":
      return "expired";
    default:
      return "pending_activation";
  }
}

export function toIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number"
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/** Øre → kroner, så beløb passer til NUMERIC(10,2). */
export function toKroner(amount: number | null | undefined): number {
  return (amount ?? 0) / 100;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Manglende miljøvariabel: ${name}`);
  }
  return value;
}
