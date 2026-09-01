/**
 * Virksomhedens stamdata og de juridiske sider.
 *
 * Samlet ét sted, fordi de samme oplysninger optræder i footeren, i
 * privatlivspolitikken og i handelsbetingelserne. Står de tre steder, bliver
 * det ene rettet og de to andre glemt — og på juridiske sider er det ikke
 * kun grimt, det er forkert.
 */

export const COMPANY = {
  /** Tjenestens navn udadtil. */
  service: "Ejendelsregisteret",
  /** Den juridiske enhed bag. */
  legalName: "Greydot",
  cvr: "34399131",
  email: "kontakt@ejendelsregisteret.dk",
  phone: "+45 22 55 41 42",
  address: "J. Skjoldborgs Vej 57, 9230 Åbyhøj",
} as const;

/** Datoen der står øverst på alle tre juridiske sider. */
export const LEGAL_UPDATED = "1. september 2026";

export const LEGAL_PAGES = [
  { label: "Privatlivspolitik", href: "/privatlivspolitik" },
  { label: "Handelsbetingelser", href: "/handelsbetingelser" },
  { label: "Cookiepolitik", href: "/cookiepolitik" },
] as const;

/**
 * Footerens navigation.
 *
 * Ikke det samme som SECTIONS i lib/nav.ts: den øverste bjælke er til at
 * skifte mellem sider undervejs, footeren er der man leder når man er nået
 * til bunden uden at finde det man søgte. Derfor er "Bliv medlem" med her.
 */
export const FOOTER_NAV = [
  { label: "Forside", href: "/" },
  { label: "Slå serienummer op", href: "/serienummer" },
  { label: "Guide", href: "/guide" },
  { label: "Priser", href: "/priser" },
  { label: "Bliv medlem", href: "/bliv-medlem" },
  { label: "Kontakt", href: "/kontakt" },
] as const;
