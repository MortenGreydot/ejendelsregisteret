import { COMPANY } from "@/lib/legal";
import { SITE_URL } from "@/lib/site";

/**
 * Strukturerede data om organisationen bag sitet.
 *
 * Google er tydelig om at schema.org IKKE er et krav for at komme med i de
 * AI-genererede svar, og der findes ingen særlig markup til formålet. Den
 * her er der for det almindelige søgeresultat: den knytter navn, logo,
 * CVR-nummer og kontaktadresse sammen, så Google kan vise et
 * sammenhængende billede af hvem afsenderen er.
 *
 * Holdt til det vi rent faktisk kan stå inde for. Opfundne felter som
 * anmeldelser eller vurderinger er direkte i strid med Googles
 * retningslinjer for spam.
 */
export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organisation`,
        name: COMPANY.service,
        legalName: COMPANY.legalName,
        url: SITE_URL,
        logo: `${SITE_URL}/images/logo-ejendel.png`,
        // taxID frem for vatID: CVR er et registreringsnummer, ikke et
        // momsnummer (det ville være DK efterfulgt af cifrene).
        taxID: COMPANY.cvr,
        address: {
          "@type": "PostalAddress",
          streetAddress: "J. Skjoldborgs Vej 57",
          postalCode: "9230",
          addressLocality: "Åbyhøj",
          addressCountry: "DK",
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: COMPANY.email,
          telephone: COMPANY.phone,
          contactType: "customer support",
          availableLanguage: "Danish",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: COMPANY.service,
        inLanguage: "da-DK",
        publisher: { "@id": `${SITE_URL}/#organisation` },
        // Serienummeropslaget er sitets egen søgefunktion. Uden den her
        // ved Google ikke at der findes en søgning at pege på.
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/serienummer?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Indholdet er vores eget og indeholder ingen brugerdata, så der er
      // intet at injicere. Ville et felt komme fra en bruger, skulle det
      // escapes først.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
