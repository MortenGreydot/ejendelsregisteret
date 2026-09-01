import type { Metadata } from "next";
import Link from "next/link";

import { COMPANY } from "@/lib/legal";
import { PLANS } from "@/lib/plans";

import {
  Callout,
  LegalLayout,
  List,
  Section,
} from "../components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Handelsbetingelser | Ejendelsregisteret",
  description:
    "Priser, betaling, fortrydelsesret og opsigelse for medlemskab hos Ejendelsregisteret.",
};

/** Handelsbetingelser */
export default function TermsPage() {
  // Priserne læses fra PLANS, så betingelserne ikke kan komme til at stå
  // med et andet beløb end prissiden og checkout.
  const privat = PLANS.privat;
  const erhverv = PLANS.erhverv;

  return (
    <LegalLayout
      title="Handelsbetingelser"
      intro="Betingelserne for medlemskab hos Ejendelsregisteret. Læs især afsnittet om fortrydelsesret og om hvad tjenesten ikke er."
    >
      <Section n={1} title="Generelt">
        <p>
          Disse betingelser gælder for alle medlemskaber hos{" "}
          {COMPANY.service}, som drives af {COMPANY.legalName}, CVR{" "}
          {COMPANY.cvr}, {COMPANY.address}.
        </p>
      </Section>

      <Section n={2} title="Medlemskab og priser">
        <p>Der er ét medlemskab, i to udgaver:</p>
        <List
          items={[
            <>
              <strong className="text-navy">Privat:</strong> {privat.setupFee}{" "}
              kr. i oprettelse, derefter {privat.monthlyPrice} kr./md. Alle
              beløb inkl. moms.
            </>,
            <>
              <strong className="text-navy">Erhverv:</strong> {erhverv.setupFee}{" "}
              kr. i oprettelse, derefter {erhverv.monthlyPrice} kr./md. Alle
              beløb ekskl. moms.
            </>,
          ]}
        />
        <p>
          Begge inkluderer {privat.includedItems} ejendele. Registrerer du
          flere, koster hver ekstra ejendel {privat.extraItemPrice} kr./md.
        </p>
        <Callout>
          Beløbet følger antallet. Sletter du en ejendel igen, falder
          betalingen tilsvarende på næste faktura. Der er ingen bindingsperiode
          og ingen årlig betaling. Der afregnes måned for måned.
        </Callout>
      </Section>

      <Section n={3} title="Betaling">
        <p>
          Betaling sker med betalingskort gennem Stripe. Oprettelsesgebyret
          opkræves sammen med den første måned. Herefter fornyes medlemskabet
          automatisk hver måned, indtil du opsiger det.
        </p>
        <p>
          Går en betaling ikke igennem, får du besked på mail og kan opdatere
          dit kort. Indtil betalingen er på plads, kan du ikke oprette nye
          ejendele, men du beholder adgangen til dem du allerede har
          registreret.
        </p>
      </Section>

      <Section n={4} title="Fortrydelsesret">
        <p>
          Som forbruger har du 14 dages fortrydelsesret fra den dag du tegner
          medlemskabet, jf. forbrugeraftaleloven. Skriv til{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-orange underline underline-offset-4"
          >
            {COMPANY.email}
          </a>
          , så refunderer vi det betalte.
        </p>
        <Callout>
          Beder du os om at gå i gang med det samme, altså begynder at bruge
          tjenesten inden for de 14 dage, bortfalder fortrydelsesretten når
          ydelsen er leveret. Du bekræfter det, når du gennemfører betalingen.
        </Callout>
        <p className="text-[14px] text-muted">
          Fortrydelsesretten gælder ikke erhvervskunder.
        </p>
      </Section>

      <Section n={5} title="Opsigelse">
        <p>
          Du kan opsige når som helst under Min side. Opsigelsen træder i kraft
          ved periodens udløb, så du beholder adgangen resten af den måned du
          har betalt for. Der refunderes ikke for ubrugt tid.
        </p>
        <p>
          Efter udløbet kan du stadig se og hente dine registrerede ejendele,
          men ikke oprette nye. Vil du have alt fjernet, kan du slette din konto.
          Se{" "}
          <Link
            href="/privatlivspolitik"
            className="text-orange underline underline-offset-4"
          >
            privatlivspolitikken
          </Link>{" "}
          for hvad der sker med dine data.
        </p>
      </Section>

      <Section n={6} title="Ændring af priser og betingelser">
        <p>
          Vi kan ændre priser og betingelser med mindst 30 dages varsel på
          mail. Ændringen træder i kraft ved næste fornyelse, og du kan altid
          opsige inden da, hvis du ikke vil være med til den.
        </p>
      </Section>

      <Section n={7} title="Hvad tjenesten er, og hvad den ikke er">
        <Callout>
          Ejendelsregisteret er et registreringsværktøj. Det er ikke en
          forsikring, og det forhindrer ikke tyveri.
        </Callout>
        <p>
          Vi hjælper dig med at have dokumentationen klar, altså serienummer,
          kvittering og billeder samlet ét sted, og vi gør det muligt at slå et
          serienummer op. Vi kan ikke garantere at en registreret genstand
          kommer til rette, at en forsikring anerkender dokumentationen, eller
          at en finder tager kontakt.
        </p>
        <p>
          Vores ansvar er begrænset til det beløb du har betalt for
          medlemskabet. Vi er ikke ansvarlige for indirekte tab, herunder tabt
          fortjeneste eller værdien af en mistet genstand.
        </p>
      </Section>

      <Section n={8} title="Dit ansvar som bruger">
        <List
          items={[
            "Du er ansvarlig for at de oplysninger du registrerer er korrekte. Et forkert serienummer gør registreringen værdiløs.",
            "Du må kun registrere ejendele du selv ejer.",
            "Du må ikke bruge opslaget eller kontaktformularen til chikane, spam eller til at afsøge andres ejendele.",
            "Misbrug kan medføre at vi lukker din konto uden refusion.",
          ]}
        />
      </Section>

      <Section n={9} title="Tvister">
        <p>
          Eventuelle tvister afgøres efter dansk ret ved de danske domstole.
        </p>
        <p>
          Er du forbruger, kan du klage til Center for Klageløsning under
          Nævnenes Hus,{" "}
          <a
            href="https://naevneneshus.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange underline underline-offset-4"
          >
            naevneneshus.dk
          </a>
          . Skriv gerne til os først. Det plejer at gå hurtigere.
        </p>
      </Section>
    </LegalLayout>
  );
}
