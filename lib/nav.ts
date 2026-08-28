/**
 * Sektionerne i navigationen.
 *
 * Ligger her frem for i SectionNav, fordi både bjælken på desktop og
 * mobilmenuen skal bruge dem. Med to kopier ville en ny side skulle
 * tilføjes to steder — og den ene ville blive glemt.
 *
 * `as const` er nødvendig for at Next kan typetjekke href mod de faktiske
 * ruter.
 */
export const SECTIONS = [
  { label: "Forside", href: "/" },
  { label: "Kontakt", href: "/kontakt" },
  { label: "Serienummer", href: "/serienummer" },
  { label: "Priser", href: "/priser" },
] as const;

/**
 * Er stien den aktive for et menupunkt?
 *
 * Forsiden matcher kun eksakt — ellers ville den være aktiv overalt. De
 * øvrige matcher også undersider, men kræver en skråstreg, så /kontakter
 * ikke fejlagtigt markerer /kontakt.
 */
export function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}
