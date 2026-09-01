/**
 * Omdirigeringer fra det gamle WordPress-site.
 *
 * Uden dem starter sitet forfra på al optjent synlighed: Google har
 * indekseret de gamle adresser, og et 404 fortæller den at siden er væk
 * frem for flyttet. En 308 overfører placeringen til den nye adresse.
 *
 * Rækkefølgen er afgørende. Next tager den første regel der matcher, så
 * de præcise mønstre skal stå før de brede.
 *
 * Bemærk at hver adresse peger på en side der handler om nogenlunde det
 * samme. Google behandler en omdirigering til forsiden som et blødt 404 og
 * kasserer placeringen alligevel, så det nytter ikke at sende alt derhen.
 */
export type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

const permanent = (source: string, destination: string): Redirect => ({
  source,
  destination,
  permanent: true,
});

export const LEGACY_REDIRECTS: Redirect[] = [
  // ── Faste sider ────────────────────────────────────────────────
  permanent("/soeg", "/serienummer"),
  permanent("/opret", "/bliv-medlem"),
  permanent("/opret-mail", "/bliv-medlem"),
  permanent("/registrer-ejendel", "/bliv-medlem"),
  permanent("/log-ind", "/bliv-medlem"),
  permanent("/dashboard", "/min-side"),
  permanent("/checkout", "/priser"),
  permanent("/faq", "/priser"),
  permanent("/b2b", "/priser"),
  permanent("/partner", "/"),
  permanent("/om", "/"),
  permanent("/overdragelse", "/"),
  permanent("/forside", "/"),

  // ── /info/ ─────────────────────────────────────────────────────
  permanent("/info/serienummer", "/guide#serienummer"),
  permanent("/info/mistet", "/guide#mistet"),
  permanent("/info/stjaalet", "/guide#mistet"),
  permanent("/info/registrer", "/guide#registrer"),
  permanent("/info/privat", "/priser"),
  permanent("/info/erhverv", "/priser"),
  permanent("/info/saadan-virker-det", "/guide"),
  // Resten af /info/ handler om dokumentation i almindelighed.
  permanent("/info/:slug", "/guide"),

  // ── /guide/ ────────────────────────────────────────────────────
  // "Sådan finder du serienummeret på din iPhone" og de 19 andre af
  // slagsen hører til opslagssiden.
  permanent("/guide/serienummer-:slug", "/guide#serienummer"),
  permanent("/guide/stelnummer-:slug", "/guide#serienummer"),
  permanent("/guide/imei-:slug", "/guide#serienummer"),

  // "Sådan registrerer du din cykel" og de 14 andre.
  permanent("/guide/registrer-:slug", "/guide#registrer"),

  // Målgruppesiderne: for-haandvaerkere, for-familier og så videre.
  permanent("/guide/for-:slug", "/priser"),

  // Situationssiderne (stjaalet-cykel, indbrud-i-hjemmet, brand-i-hjemmet
  // og resten). De handler om at stå med et tab, og guiden er det nærmeste
  // vi har, indtil indholdet er flyttet med over.
  permanent("/guide/:slug", "/guide"),
];
