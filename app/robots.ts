import type { MetadataRoute } from "next";

import { PRIVATE_PATHS, SITE_URL } from "@/lib/site";

/**
 * robots.txt.
 *
 * Genereres frem for at ligge som statisk fil i /public, så adressen til
 * sitemap'et følger domænet automatisk. En hardkodet URL ville pege på
 * produktion fra et testmiljø og omvendt.
 *
 * Alt er tilladt bortset fra det der kræver login. Vi blokerer bevidst
 * ikke AI-crawlere: skal siden kunne findes gennem Googles AI-svar, skal
 * indholdet kunne hentes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
