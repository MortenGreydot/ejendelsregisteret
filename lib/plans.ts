import type { Audience } from "./audience-shared";

export type PlanId = Audience;

/** Beløb i hele kroner og antal ejendele. Alt andet i filen bygges af dem. */
export type Pricing = {
  monthlyPrice: number;
  setupFee: number;
  includedItems: number;
  extraItemPrice: number;
};

/**
 * ── HER RETTES PRISERNE ──────────────────────────────────────────────
 *
 * Det er de eneste tal på hele sitet. Alt andet — prissiden, forsiden,
 * oprettelsen, guiden, handelsbetingelserne, FAQ'en, Min side og
 * sidernes metadata — regnes ud herfra. Rettes et tal her, skifter det
 * alle steder.
 *
 * Skriv aldrig et beløb eller et antal ejendele direkte i en komponent
 * eller en tekst. Så snart det står to steder, bliver det ene rettet og
 * det andet glemt — og på en prisside er det ikke bare grimt, det er en
 * forkert oplysning til en kunde.
 *
 * ── Tallene her VISER kun. De OPKRÆVER ikke ────────────────────────
 *
 * Det er Stripe der bestemmer hvad kunden faktisk trækkes. Ændrer du et
 * beløb her uden også at ændre prisen i Stripe, viser sitet ét beløb og
 * fakturaen et andet. Rækkefølgen er: ret prisen i Stripe først, ret så
 * tallet her.
 *
 * Læg ikke price-id'er i denne fil — den ryger med i browser-bundlen.
 * Klienten sender kun `plan.id`; create-checkout slår price-id'et op i
 * sin egen env.
 *
 * ── De tre steder tallene også står, uden for sitet ────────────────
 *
 *   1. Stripe            — de rigtige priser. Autoriteten.
 *   2. subscriptions.included_items — sættes pr. kunde ved checkout og er
 *      det databasetriggeren tæller op imod. Standardværdien er sat i
 *      migrationen 20260824080756 og skal følge includedItems herunder.
 *   3. supabase/functions/send-email — mailen "du har nået grænsen"
 *      henter antallet fra kundens abonnement, men stykprisen står som en
 *      konstant i filen, fordi den kun findes i Stripe.
 */
const PRICING: Record<PlanId, Pricing> = {
  privat: {
    monthlyPrice: 29,
    setupFee: 99,
    includedItems: 5,
    extraItemPrice: 2,
  },
  erhverv: {
    monthlyPrice: 49,
    setupFee: 99,
    includedItems: 5,
    extraItemPrice: 2,
  },
};

const privat = PRICING.privat;
const erhverv = PRICING.erhverv;

export type Plan = Pricing & {
  id: PlanId;
  /** Lille orange label over overskriften */
  eyebrow: string;
  /** Sidens H1 */
  headline: string;
  /** Brødtekst under H1 */
  intro: string;
  /** Kortets titel */
  name: string;
  tagline: string;
  features: string[];
  /**
   * Om de viste beløb er inkl. moms.
   *
   * Forbrugerpriser skal i Danmark vises inkl. moms, mens erhvervspriser
   * konventionelt vises ekskl. Værdien skal matche `tax_behavior` på
   * prisen i Stripe — ellers viser siden ét beløb og fakturaen et andet.
   */
  vatIncluded: boolean;
  /** Lyst kort på privat, mørkt navy kort på erhverv */
  theme: "light" | "dark";
};

/** Punkterne på plankortet. De to første er tal, resten er faste løfter. */
function features(p: Pricing): string[] {
  return [
    `Op til ${p.includedItems} ejendele inkluderet`,
    `${p.extraItemPrice} kr. pr. ekstra ejendel/md.`,
    "Ubegrænsede billeder per ejendel",
    "Upload kvittering & garantibevis",
    "Opsigelse når som helst",
  ];
}

export const PLANS: Record<PlanId, Plan> = {
  privat: {
    ...privat,
    id: "privat",
    eyebrow: "Privat",
    headline: "Privat medlemskab",
    intro:
      `Betal ${privat.setupFee} kr. ved oprettelse, derefter ` +
      `${privat.monthlyPrice} kr./md. Inkluderer ${privat.includedItems} ` +
      `ejendele. Tilføj flere for blot ${privat.extraItemPrice} kr./stk./md.`,
    name: "Privat",
    tagline: "Til dig og din husholdning",
    features: features(privat),
    vatIncluded: true,
    theme: "light",
  },
  erhverv: {
    ...erhverv,
    id: "erhverv",
    eyebrow: "Erhverv",
    headline: "Erhvervsmedlemskab",
    intro:
      `Betal ${erhverv.setupFee} kr. ved oprettelse, derefter ` +
      `${erhverv.monthlyPrice} kr./md. Inkluderer ${erhverv.includedItems} ejendele.`,
    name: "Erhverv",
    tagline: "Til virksomheder og håndværkere",
    features: features(erhverv),
    vatIncluded: false,
    theme: "dark",
  },
};

export const vatLabel = (plan: Plan) =>
  plan.vatIncluded ? "inkl. moms" : "ekskl. moms";

/**
 * Prisen på én linje.
 *
 * Bruges hvor der kun er plads til en enkelt sætning — i login-dialogen og
 * i sidernes metadata. Findes som funktion frem for som tekst, så den
 * følger med når et beløb ændres.
 */
export const priceSummary = (plan: Plan) =>
  `${plan.setupFee} kr. oprettelse · ${plan.monthlyPrice} kr./md. · ` +
  `${plan.includedItems} ejendele inkl.`;

/** De fire trin på prissiden. Tallene følger den viste plan. */
export const steps = (plan: Plan) => [
  { title: "Vælg plan", body: "Privat eller erhverv" },
  { title: "Betal via Stripe", body: `${plan.setupFee} kr. engangsgebyr` },
  {
    title: "Registrer ejendele",
    body: `Op til ${plan.includedItems} inkluderet`,
  },
  { title: "Du er dækket", body: "Dokumentation klar" },
];

/** Spørgsmål og svar på prissiden. Tallene følger den viste plan. */
export const faq = (plan: Plan) => [
  {
    question: `Hvad sker der når jeg opretter mere end ${plan.includedItems} ejendele?`,
    answer:
      `Du kan altid tilføje flere ejendele. For hver ejendel ud over de ` +
      `${plan.includedItems} inkluderede opkræves der automatisk ` +
      `${plan.extraItemPrice} kr. pr. styk pr. måned via Stripe.`,
  },
  {
    question: "Kan jeg opsige mit abonnement?",
    answer:
      "Ja, du kan opsige til enhver tid via din profil. Abonnementet løber til udgangen af den betalte periode.",
  },
  {
    question: "Hvilken betalingsmetode accepteres?",
    answer:
      "Betaling håndteres sikkert via Stripe. Du kan betale med alle gængse kreditkort (Visa, Mastercard, MobilePay).",
  },
];
