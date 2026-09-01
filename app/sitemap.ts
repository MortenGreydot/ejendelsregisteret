import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * sitemap.xml.
 *
 * Kun offentlige sider. /min-side er udeladt, fordi den kræver login.
 *
 * `lastModified` sættes kun hvor vi faktisk kender datoen. Fristelsen er at
 * sætte byggetidspunktet på alle sider, men så ville hver deploy påstå at
 * hele sitet er opdateret. Google bruger datoen til at vurdere friskhed, og
 * et signal der altid siger "i dag" holder op med at betyde noget.
 */
/** Skal følge LEGAL_UPDATED i lib/legal.ts. */
const LEGAL_DATE = new Date("2026-09-01");

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number) => ({
    url: `${SITE_URL}${path}`,
    priority,
  });

  return [
    page("/", 1),
    page("/priser", 0.9),
    page("/serienummer", 0.9),
    page("/guide", 0.9),
    page("/bliv-medlem", 0.8),
    page("/kontakt", 0.6),

    // De juridiske sider har en dato vi kender, og den står også på siderne.
    ...["/privatlivspolitik", "/handelsbetingelser", "/cookiepolitik"].map(
      (path) => ({
        url: `${SITE_URL}${path}`,
        lastModified: LEGAL_DATE,
        priority: 0.3,
      }),
    ),
  ];
}
