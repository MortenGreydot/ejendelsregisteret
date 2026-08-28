import type { Audience } from "./audience-shared";

export type PlanId = Audience;

export type Plan = {
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
  /** Beløb i hele kroner */
  monthlyPrice: number;
  setupFee: number;
  includedItems: number;
  extraItemPrice: number;
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

/**
 * Al pris- og tekstdata ét sted. Skal en pris ændres, ændres den kun her.
 *
 * Stripe: læg IKKE price-id'er i denne fil — den importeres af klient-
 * komponenter og ryger derfor med i browser-bundlen. Når Stripe kobles på,
 * sender knappen kun `plan.id` til serveren, som slår det tilsvarende
 * price-id op i sin egen env. Ellers kan en bruger ændre prisen i devtools
 * inden checkout oprettes.
 */
export const PLANS: Record<PlanId, Plan> = {
  privat: {
    id: "privat",
    eyebrow: "Privat",
    headline: "Privat medlemskab",
    intro:
      "Betal 99 kr. ved oprettelse, derefter 29 kr./md. Inkluderer 5 ejendele — tilføj flere for blot 2 kr./stk./md.",
    name: "Privat",
    tagline: "Til dig og din husholdning",
    monthlyPrice: 29,
    setupFee: 99,
    includedItems: 5,
    extraItemPrice: 2,
    features: [
      "Op til 5 ejendele inkluderet",
      "2 kr. pr. ekstra ejendel/md.",
      "Ubegrænsede billeder per ejendel",
      "Upload kvittering & garantibevis",
      "Opsigelse når som helst",
    ],
    vatIncluded: true,
    theme: "light",
  },
  erhverv: {
    id: "erhverv",
    eyebrow: "Erhverv",
    headline: "Erhvervsmedlemskab",
    intro:
      "Betal 99 kr. ved oprettelse, derefter 49 kr./md. Inkluderer 5 ejendele.",
    name: "Erhverv",
    tagline: "Til virksomheder og håndværkere",
    // Beløbene er ikke endeligt fastlagt. De skal matche priserne i Stripe
    // — koden viser dem kun, Stripe opkræver dem.
    monthlyPrice: 49,
    setupFee: 99,
    includedItems: 5,
    extraItemPrice: 2,
    features: [
      "Op til 5 ejendele inkluderet",
      "2 kr. pr. ekstra ejendel/md.",
      "Ubegrænsede billeder per ejendel",
      "Upload kvittering & garantibevis",
      "Opsigelse når som helst",
    ],
    vatIncluded: false,
    theme: "dark",
  },
};

export const vatLabel = (plan: Plan) =>
  plan.vatIncluded ? "inkl. moms" : "ekskl. moms";

export const STEPS = [
  { title: "Vælg plan", body: "Privat eller erhverv" },
  { title: "Betal via Stripe", body: "99 kr. engangsgebyr" },
  { title: "Registrer ejendele", body: "Op til 5 inkluderet" },
  { title: "Du er dækket", body: "Dokumentation klar" },
];

export const FAQ = [
  {
    question: "Hvad sker der når jeg opretter mere end 5 ejendele?",
    answer:
      "Du kan altid tilføje flere ejendele. For hver ejendel ud over de 5 inkluderede opkræves der automatisk 2 kr. pr. styk pr. måned via Stripe.",
  },
  {
    question: "Kan jeg opsige mit abonnement?",
    answer:
      "Ja — du kan opsige til enhver tid via din profil. Abonnementet løber til udgangen af den betalte periode.",
  },
  {
    question: "Hvilken betalingsmetode accepteres?",
    answer:
      "Betaling håndteres sikkert via Stripe. Du kan betale med alle gængse kreditkort (Visa, Mastercard, MobilePay).",
  },
];
