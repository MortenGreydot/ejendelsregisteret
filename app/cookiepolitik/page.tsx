import type { Metadata } from "next";
import Link from "next/link";

import { COMPANY } from "@/lib/legal";

import {
  Callout,
  LegalLayout,
  List,
  Section,
} from "../components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Cookiepolitik | Ejendelsregisteret",
  description:
    "Vi bruger kun de cookies der skal til for at siden virker. Ingen analyse, ingen marketing, ingen deling med annoncenetværk.",
};

/** Cookiepolitik */
export default function CookiePage() {
  return (
    <LegalLayout
      title="Cookiepolitik"
      intro="Den korte version: vi bruger to cookies, begge nødvendige for at siden virker. Vi måler ikke på dig, og vi deler ikke noget med annoncenetværk."
    >
      <Section n={1} title="De cookies vi sætter">
        <List
          items={[
            <>
              <strong className="text-navy">audience:</strong> husker om du
              har valgt Privat eller Erhverv, så du ser de rigtige priser og
              tekster. Indeholder kun ordet &quot;privat&quot; eller
              &quot;erhverv&quot;.
            </>,
            <>
              <strong className="text-navy">
                sb-&hellip;-auth-token:
              </strong>{" "}
              holder dig logget ind. Sættes af Supabase, som står for vores
              login. Uden den ville du blive logget ud ved hvert sideskift.
            </>,
          ]}
        />
      </Section>

      <Section n={2} title="Cookies fra Stripe">
        <p>
          Når du betaler, sender vi dig videre til Stripes eget
          betalingsvindue. Stripe sætter sine egne cookies på deres domæne for
          at gennemføre betalingen og opdage svindel. De hører under Stripes
          egen politik, ikke vores.
        </p>
      </Section>

      <Section n={3} title="Det vi ikke bruger">
        <p>
          Vi har hverken Google Analytics, Facebook-pixel, annoncesporing eller
          nogen anden form for statistik- eller marketingcookie. Vi følger ikke
          med i hvilke sider du besøger, og vi bygger ingen profil på dig.
        </p>
        <Callout>
          Derfor er der heller intet cookiebanner. Reglerne kræver kun samtykke
          til cookies der ikke er nødvendige for tjenesten, og dem har vi ikke.
          Et banner ville være et klik uden indhold.
        </Callout>
      </Section>

      <Section n={4} title="Sådan slipper du af med dem">
        <p>
          Du kan slette og blokere cookies i din browsers indstillinger. Vær
          opmærksom på at du bliver logget ud, hvis du sletter login-cookien, og
          at siden vil spørge om Privat eller Erhverv igen, hvis du sletter den
          anden.
        </p>
      </Section>

      <Section n={5} title="Spørgsmål">
        <p>
          Skriv til{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-orange underline underline-offset-4"
          >
            {COMPANY.email}
          </a>
          . Vil du vide hvad vi ellers gemmer, står det i{" "}
          <Link
            href="/privatlivspolitik"
            className="text-orange underline underline-offset-4"
          >
            privatlivspolitikken
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
