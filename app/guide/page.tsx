import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { PLANS } from "@/lib/plans";

import { Navbar } from "../components/Navbar";
import {
  Callout,
  List,
  Section,
  TableOfContents,
  WhereTable,
  type Chapter,
} from "../components/guide/GuideParts";

export const metadata: Metadata = {
  title: "Guide: sådan bruger du Ejendelsregisteret | Ejendelsregisteret",
  description:
    "Hele vejen igennem: hvad du skal registrere, hvor serienummeret sidder på cykel, telefon og værktøj, hvad du gør hvis noget bliver stjålet, og hvad forsikringen beder om.",
  alternates: { canonical: "/guide" },
};

const CHAPTERS: Chapter[] = [
  { id: "hvad", title: "Hvad Ejendelsregisteret er" },
  { id: "kom-i-gang", title: "Kom i gang" },
  { id: "registrer", title: "Registrér en ejendel" },
  { id: "serienummer", title: "Sådan finder du serienummeret" },
  { id: "billeder", title: "Billeder og kvitteringer" },
  { id: "mistet", title: "Hvis noget bliver væk" },
  { id: "opslag", title: "Når nogen slår dit nummer op" },
  { id: "brugtkoeb", title: "Køber du brugt?" },
  { id: "forsikring", title: "Over for forsikringen" },
  { id: "medlemskab", title: "Medlemskab og priser" },
  { id: "data", title: "Dine data" },
];

/** Serienumre sidder sjældent samme sted to gange. */
const WHERE_ROWS = [
  {
    item: "iPhone",
    where: "Indstillinger → Generelt → Om. Tast *#06# for IMEI-nummeret, som politiet bruger.",
  },
  {
    item: "Android-telefon",
    where: "Indstillinger → Om telefonen. *#06# giver også her IMEI.",
  },
  {
    item: "MacBook",
    where: "Æble-menuen → Om denne Mac. Står også med små typer i bunden af maskinen.",
  },
  {
    item: "Windows-laptop",
    where: "Mærkat i bunden. Ellers kommandoen wmic bios get serialnumber i Kommandoprompt.",
  },
  {
    item: "iPad og tablet",
    where: "Indstillinger → Generelt → Om. Står også indgraveret på bagsiden.",
  },
  {
    item: "Cykel",
    where: "Stelnummeret er stemplet i metallet, oftest under kranken hvor pedalerne sidder. Ellers på gaflen eller under sadelpinden.",
  },
  {
    item: "Elcykel",
    where: "Stelnummer som ovenfor, plus et selvstændigt motornummer på motorhuset. Skriv begge ind.",
  },
  {
    item: "Elløbehjul",
    where: "På stammen lige over forhjulet, eller under dækslet ved batteriet.",
  },
  {
    item: "Kamera",
    where: "Mærkat i bunden af huset eller inde i batterirummet. Objektiver har deres eget nummer på fatningen.",
  },
  {
    item: "Ur",
    where: "Indgraveret på bagsiden af urkassen. Ofte meget småt, så brug telefonens kamera til at zoome.",
  },
  {
    item: "Elværktøj",
    where: "Mærkat på husets side, tit under batteriet eller bag håndtaget.",
  },
  {
    item: "Drone",
    where: "Under batteriet, og i producentens app under enhedsoplysninger.",
  },
  {
    item: "Spillekonsol",
    where: "Mærkat på bagsiden eller undersiden.",
  },
  {
    item: "Musikinstrument",
    where: "Guitarer: på halsklodsen eller i lydhullet. Blæseinstrumenter: indgraveret nær ventilerne.",
  },
];

/** Guide: sådan bruger du Ejendelsregisteret */
export default function GuidePage() {
  const plan = PLANS.privat;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-orange">
            Guide
          </p>
          <h1 className="mt-4 font-display text-[34px] leading-[1.15] font-normal text-navy sm:text-[44px]">
            Sådan bruger du Ejendelsregisteret
          </h1>
          <p className="mt-5 text-[17px] leading-[1.7] text-navy">
            Fra den første registrering til den dag du får brug for
            dokumentationen. Læs det hele, eller hop ned til det du står med.
          </p>

          <div className="mt-10">
            <TableOfContents chapters={CHAPTERS} />
          </div>

          <div className="mt-14 space-y-14">
            <Section
              id="hvad"
              n={1}
              title="Hvad Ejendelsregisteret er"
              lead="Et sted at samle dokumentationen for det du ejer, inden du får brug for den."
            >
              <p>
                De fleste opdager først hvor lidt de kan dokumentere, når
                skaden er sket. Kvitteringen er væk, serienummeret stod på en
                æske der blev smidt ud, og de eneste billeder er nogle
                tilfældige feriefotos hvor cyklen tilfældigvis er med.
              </p>
              <p>
                Her ligger serienummer, kvittering og billeder samlet på hver
                enkelt genstand. Du kan hente det frem den dag forsikringen
                spørger, melde noget savnet så en finder kan slå det op, og
                overdrage dokumentationen til køberen når du sælger.
              </p>
              <Callout title="Det er ikke en forsikring">
                Vi erstatter ingenting, og en registrering forhindrer ikke
                tyveri. Det vi gør, er at sikre at du kan bevise hvad du ejede,
                og at en ærlig finder kan finde tilbage til dig.
              </Callout>
            </Section>

            <Section
              id="kom-i-gang"
              n={2}
              title="Kom i gang"
              lead="Tre skridt, og du kan registrere den første ting."
            >
              <List
                items={[
                  <>
                    <strong className="text-navy">Vælg privat eller erhverv</strong>{" "}
                    øverst på siden. Valget afgør priser og moms, og du kan
                    skifte igen senere.
                  </>,
                  <>
                    <strong className="text-navy">Opret en konto</strong> med
                    navn, mail og en adgangskode. Er du erhverv, skal
                    virksomhedsnavn og CVR med.
                  </>,
                  <>
                    <strong className="text-navy">Aktivér medlemskabet.</strong>{" "}
                    Betalingen går gennem Stripe, og du lander direkte på Min
                    side bagefter.
                  </>,
                ]}
              />
              <p>
                Første gang popper der en guide op der tager dig gennem den
                første ejendel felt for felt. Den kan springes over, og du kan
                altid åbne den igen fra Min side.
              </p>
            </Section>

            <Section
              id="registrer"
              n={3}
              title="Registrér en ejendel"
              lead="Serienummeret er det vigtigste felt. Resten kan udfyldes senere."
            >
              <p>
                En registrering består af navn, mærke, kategori, beskrivelse,
                et eller flere serienumre, billeder og kvitteringer. Kun navnet
                er påkrævet, men en registrering uden serienummer kan hverken
                slås op eller bruges til at bevise at netop den genstand var
                din.
              </p>
              <List
                items={[
                  <>
                    <strong className="text-navy">Navn:</strong> vær konkret.
                    &quot;Trek Marlin 7, mat sort&quot; er bedre end
                    &quot;cykel&quot;.
                  </>,
                  <>
                    <strong className="text-navy">Serienummer:</strong> skriv
                    det af tegn for tegn. Bindestreger og mellemrum er uden
                    betydning når der søges, men et forkert ciffer gør
                    registreringen ubrugelig.
                  </>,
                  <>
                    <strong className="text-navy">Flere numre:</strong> nogle
                    ting har mere end ét. En elcykel har både stelnummer og
                    motornummer, en telefon både serienummer og IMEI. Læg dem
                    alle ind.
                  </>,
                  <>
                    <strong className="text-navy">Kategori:</strong> skriv
                    hvad som helst. Findes kategorien ikke, oprettes den.
                  </>,
                  <>
                    <strong className="text-navy">Beskrivelse:</strong> plads
                    til det der kendetegner netop din genstand: en ridse,
                    et klistermærke, en udskiftet del.
                  </>,
                ]}
              />
              <Callout title="Start med det dyreste">
                Du behøver ikke registrere alt på én dag. Tag cyklen, telefonen
                og værktøjet først. Det er dem der bliver stjålet, og dem
                forsikringen stiller flest spørgsmål om.
              </Callout>
            </Section>

            <Section
              id="serienummer"
              n={4}
              title="Sådan finder du serienummeret"
              lead="Det sidder sjældent samme sted to gange. Her er de mest almindelige."
            >
              <WhereTable rows={WHERE_ROWS} />
              <p>
                Kan du ikke finde det, så prøv den oprindelige æske, købsbilaget
                eller producentens app. Mange producenter viser nummeret under
                enhedsoplysninger, når produktet er registreret hos dem.
              </p>
              <Callout title="Tag et billede af mærkaten">
                Ud over at skrive nummeret ind, så fotografér mærkaten. Så kan
                du altid kontrollere om der stod et nul eller et O, og
                forsikringen kan se at nummeret hører til genstanden.
              </Callout>
            </Section>

            <Section
              id="billeder"
              n={5}
              title="Billeder og kvitteringer"
              lead="Fire billeder gør arbejdet: helheden, mærkaten, kendetegnet og kvitteringen."
            >
              <List
                items={[
                  "Et billede af hele genstanden, så den kan genkendes.",
                  "Et nærbillede af mærkaten med serienummeret.",
                  "Et billede af det der gør netop din genstand særlig: en ridse, en opgradering, en gravering.",
                  "Kvitteringen, garantibeviset eller fakturaen.",
                ]}
              />
              <p>
                Der er plads til {6} billeder og {4} kvitteringer pr. ejendel.
                Hver fil må fylde op til 10 MB, og vi tager imod PNG, JPG og
                WEBP. Kvitteringer må også være PDF.
              </p>
              <Callout title="Kommer du fra en iPhone?">
                iPhones gemmer som standard i HEIC, som de fleste browsere ikke
                kan vise. Vælger du billedet gennem Fotos-appen frem for
                Filer-appen, laver iOS selv om til JPG undervejs.
              </Callout>
            </Section>

            <Section
              id="mistet"
              n={6}
              title="Hvis noget bliver væk"
              lead="Skift status først. Det er det der gør registreringen aktiv udadtil."
            >
              <p>
                Under Min side kan du markere en ejendel som savnet eller
                stjålet. Statussen er det første en finder ser, når de slår
                serienummeret op, og den viser hvornår du meldte den væk.
              </p>
              <List
                items={[
                  <>
                    <strong className="text-navy">Anmeld til politiet</strong>{" "}
                    med det samme ved tyveri. Ring 114 eller brug politi.dk. Du
                    får et journalnummer, som forsikringen kræver.
                  </>,
                  <>
                    <strong className="text-navy">Skift status her</strong>, så
                    genstanden er markeret hvis nogen slår nummeret op, for
                    eksempel af en køber der tjekker en brugthandel.
                  </>,
                  <>
                    <strong className="text-navy">Hent dokumentationen</strong>{" "}
                    og send den til forsikringen sammen med journalnummeret.
                  </>,
                ]}
              />
            </Section>

            <Section
              id="opslag"
              n={7}
              title="Når nogen slår dit nummer op"
              lead="De ser genstanden. De ser aldrig dig."
            >
              <p>
                Enhver kan slå et serienummer op på{" "}
                <Link
                  href="/serienummer"
                  className="font-medium text-orange underline underline-offset-4"
                >
                  opslagssiden
                </Link>
                . Der skal matches præcist, og nummeret skal være på mindst
                fire tegn. Man kan ikke søge sig frem på brudstykker.
              </p>
              <p>
                Er der en træffer, viser vi genstandens navn, mærke, kategori,
                beskrivelse, status og billeder. Vi viser <strong>ikke</strong>{" "}
                dit navn, din adresse, din mail eller dine kvitteringer.
              </p>
              <Callout title="Kontakten går gennem os">
                En finder kan skrive til dig, men beskeden går gennem
                Ejendelsregisteret, og de får aldrig din mailadresse. Du får til
                gengæld deres, så du kan svare direkte hvis du vil. Svarer du,
                kan de se din adresse, og det er dit valg.
              </Callout>
            </Section>

            <Section
              id="brugtkoeb"
              n={8}
              title="Køber du brugt?"
              lead="Slå nummeret op inden du betaler. Det tager ti sekunder."
            >
              <p>
                Bed sælgeren om serienummeret, inden I mødes, og slå det op.
                Står genstanden som meldt stjålet, ved du det inden pengene
                skifter hænder, og du undgår at stå med noget du hverken må
                beholde eller få erstattet.
              </p>
              <p>
                Vil sælgeren ikke oplyse nummeret, er det i sig selv et svar
                værd at hæfte sig ved. Nummeret afslører intet om ejeren.
              </p>
            </Section>

            <Section
              id="forsikring"
              n={9}
              title="Over for forsikringen"
              lead="De beder om det samme hver gang. Her ligger det klar."
            >
              <p>
                Et forsikringsselskab vil typisk se købskvittering,
                serienummer, billeder af genstanden og, ved tyveri, en
                politianmeldelse med journalnummer. Mangler kvitteringen,
                ender det ofte med afslag eller en erstatning efter skøn.
              </p>
              <p>
                Vi er ikke part i din sag og kan ikke love at et selskab
                accepterer noget bestemt. Det vi kan er at sørge for, at du har
                papirerne samlet den dag de spørger, i stedet for at lede i
                skuffer og gamle mails.
              </p>
            </Section>

            <Section
              id="medlemskab"
              n={10}
              title="Medlemskab og priser"
              lead={`${plan.setupFee} kr. i oprettelse, derefter ${plan.monthlyPrice} kr./md. for private.`}
            >
              <List
                items={[
                  <>
                    <strong className="text-navy">
                      {plan.includedItems} ejendele er inkluderet.
                    </strong>{" "}
                    Derudover koster hver ejendel {plan.extraItemPrice} kr./md.
                  </>,
                  <>
                    <strong className="text-navy">Beløbet følger antallet.</strong>{" "}
                    Sletter du en ejendel, falder betalingen tilsvarende på
                    næste faktura.
                  </>,
                  <>
                    <strong className="text-navy">Ingen binding.</strong> Du kan
                    opsige når som helst under Min side og beholder adgangen
                    perioden ud.
                  </>,
                ]}
              />
              <p>
                Erhvervspriser og det fulde overblik står på{" "}
                <Link
                  href="/priser"
                  className="font-medium text-orange underline underline-offset-4"
                >
                  prissiden
                </Link>
                .
              </p>
            </Section>

            <Section
              id="data"
              n={11}
              title="Dine data"
              lead="Du kan få det hele slettet, og vi siger præcist hvad der bliver stående."
            >
              <p>
                Sletter du din konto under Min side, opsiges dit abonnement, og
                din profil, dine ejendele, dine billeder og dine kvitteringer
                fjernes med det samme.
              </p>
              <p>
                Dine betalingsoplysninger, altså beløb, dato og
                fakturanummer, bliver stående i fem år, fordi bogføringsloven kræver det. De er
                ikke længere knyttet til dig som person. Det står udførligt i{" "}
                <Link
                  href="/privatlivspolitik"
                  className="font-medium text-orange underline underline-offset-4"
                >
                  privatlivspolitikken
                </Link>
                .
              </p>
            </Section>
          </div>

          <div className="mt-16 rounded-sm bg-navy px-6 py-10 text-center sm:px-10">
            <p className="font-display text-[26px] leading-tight font-normal text-white">
              Klar til at registrere den første?
            </p>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/70">
              Tag den dyreste ting du ejer med et serienummer. Det tager to
              minutter.
            </p>
            <Link
              href="/bliv-medlem"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-sm bg-orange px-8 text-[16px] font-bold text-white transition-colors hover:bg-orange-dark"
            >
              Kom i gang
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
