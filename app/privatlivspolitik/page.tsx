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
  title: "Privatlivspolitik | Ejendelsregisteret",
  description:
    "Hvilke oplysninger vi behandler, hvorfor, hvem vi deler dem med, og hvad du kan se og få slettet.",
};

/** Privatlivspolitik */
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privatlivspolitik"
      intro="Her står hvad vi gemmer om dig, hvorfor vi gør det, og hvad andre kan se. Vi har holdt den kort og konkret frem for dækkende og ulæselig."
    >
      <Section n={1} title="Dataansvarlig">
        <p>
          {COMPANY.legalName}, CVR {COMPANY.cvr}
          <br />
          {COMPANY.address}
          <br />
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-orange underline underline-offset-4"
          >
            {COMPANY.email}
          </a>
        </p>
      </Section>

      <Section n={2} title="Hvilke oplysninger vi behandler">
        <List
          items={[
            <>
              <strong className="text-navy">Kontooplysninger:</strong> navn,
              e-mail og telefonnummer. Er du erhvervskunde, desuden
              virksomhedsnavn og CVR-nummer.
            </>,
            <>
              <strong className="text-navy">Dine ejendele:</strong> navn,
              mærke, kategori, beskrivelse, serienumre, billeder og
              kvitteringer, altså det du selv lægger ind.
            </>,
            <>
              <strong className="text-navy">Betaling:</strong> beløb, dato og
              fakturanummer. Selve korthåndteringen sker hos Stripe. Vi ser og
              gemmer aldrig dit kortnummer.
            </>,
            <>
              <strong className="text-navy">Teknisk data:</strong> når du
              sender en besked gennem en af vores formularer, gemmer vi et
              saltet hash af din IP-adresse i en time for at begrænse misbrug.
              Selve IP-adressen gemmer vi ikke.
            </>,
          ]}
        />
        <Callout>
          Vi fører ikke log over hvilke serienumre der bliver slået op, hverken
          dine egne eller andres.
        </Callout>
      </Section>

      <Section n={3} title="Formål og retsgrundlag">
        <List
          items={[
            <>
              <strong className="text-navy">Levering af tjenesten:</strong>
              registrering, opslag og din profil. Grundlag: opfyldelse af
              aftalen med dig.
            </>,
            <>
              <strong className="text-navy">Betaling og bogføring:</strong>
              grundlag: aftalen samt vores retlige forpligtelse efter
              bogføringsloven.
            </>,
            <>
              <strong className="text-navy">
                Kontakt mellem finder og ejer:
              </strong>{" "}
              grundlag: legitim interesse i at bringe tabte genstande tilbage
              til deres ejer.
            </>,
            <>
              <strong className="text-navy">Forebyggelse af misbrug:</strong>
              grundlag: legitim interesse i at vores formularer ikke bliver
              brugt til spam.
            </>,
            <>
              <strong className="text-navy">Servicemails om din konto:</strong>
              kvitteringer, betalingsproblemer og påmindelser. Grundlag:
              aftalen med dig.
            </>,
          ]}
        />
      </Section>

      <Section n={4} title="Hvem vi deler med">
        <p>
          Vi bruger tre databehandlere, og kun til det de står for her:
        </p>
        <List
          items={[
            <>
              <strong className="text-navy">Stripe:</strong> betaling og
              abonnement.
            </>,
            <>
              <strong className="text-navy">Supabase:</strong> database, filer
              og login.
            </>,
            <>
              <strong className="text-navy">Resend:</strong> udsendelse af
              e-mail.
            </>,
          ]}
        />
        <p>
          Vi sælger aldrig dine oplysninger, og vi deler dem ikke med
          annoncenetværk.
        </p>
      </Section>

      <Section n={5} title="Hvad andre kan se">
        <p>
          Det her er det vigtigste afsnit, så det står så præcist vi kan gøre
          det.
        </p>
        <List
          items={[
            <>
              Slår nogen et serienummer op som du har registreret, viser vi
              ejendelens navn, mærke, kategori, beskrivelse, status og
              billeder. Vi viser <strong className="text-navy">ikke</strong> dit
              navn, din e-mail eller dine kvitteringer.
            </>,
            <>
              Vil de skrive til dig, går beskeden gennem os. De får aldrig din
              e-mailadresse af os.
            </>,
            <>
              Vi giver derimod deres navn, e-mail og eventuelle telefonnummer
              videre til dig, så du kan svare direkte.
            </>,
          ]}
        />
        <Callout>
          Vælger du at svare direkte, kan modtageren se din e-mailadresse. Det
          er dit valg og ikke noget vi gør på dine vegne. Vil du være anonym,
          kan du lade være med at svare.
        </Callout>
      </Section>

      <Section n={6} title="Hvor længe vi gemmer">
        <p>
          Vi gemmer dine oplysninger så længe din konto er aktiv. Sletter du
          kontoen under Min side, opsiger vi dit abonnement og fjerner din
          profil, dine ejendele, dine billeder og dine kvitteringer med det
          samme.
        </p>
        <Callout>
          Én ting bliver stående: dine betalingsoplysninger, altså beløb, dato
          og fakturanummer. Bogføringsloven kræver at vi gemmer regnskabsmateriale
          i fem år, og det kan vi ikke fravige. De er ikke længere knyttet til
          dig som person.
        </Callout>
      </Section>

      <Section n={7} title="Dine rettigheder">
        <p>Du har ret til:</p>
        <List
          items={[
            "Indsigt i de oplysninger vi har om dig",
            "Berigtigelse af noget der er forkert",
            "Sletning af dine oplysninger",
            "Begrænsning af behandlingen",
            "Dataportabilitet, altså at få dine oplysninger udleveret",
            "At gøre indsigelse mod behandlingen",
          ]}
        />
        <p>
          Skriv til{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-orange underline underline-offset-4"
          >
            {COMPANY.email}
          </a>
          , så vender vi tilbage hurtigst muligt og senest inden for en måned.
        </p>
      </Section>

      <Section n={8} title="Klage">
        <p>
          Er du utilfreds med måden vi behandler dine oplysninger på, kan du
          klage til Datatilsynet på{" "}
          <a
            href="https://www.datatilsynet.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange underline underline-offset-4"
          >
            datatilsynet.dk
          </a>
          . Vi vil sætte pris på at høre det først, så vi får en chance for at
          rette op.
        </p>
        <p className="text-[14px] text-muted">
          Se også vores{" "}
          <Link
            href="/cookiepolitik"
            className="text-orange underline underline-offset-4"
          >
            cookiepolitik
          </Link>{" "}
          og{" "}
          <Link
            href="/handelsbetingelser"
            className="text-orange underline underline-offset-4"
          >
            handelsbetingelser
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
