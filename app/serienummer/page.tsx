import type { Metadata } from "next";
import { CircleCheck, SearchX, ShieldAlert, TriangleAlert } from "lucide-react";
import Image from "next/image";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Serienummer — Ejendelsregisteret",
  description:
    "Slå et serienummer op og se om genstanden er registreret, savnet eller meldt stjålet. Brug det inden du køber brugt, eller hvis du har fundet noget.",
};

const USES = [
  {
    title: "Inden du køber brugt",
    body: "Bed sælgeren om serienummeret og slå det op. Er genstanden meldt stjålet, ved du det inden du betaler.",
  },
  {
    title: "Hvis du har fundet noget",
    body: "Står nummeret registreret, kan ejeren kontaktes gennem os — uden at nogen af jer får hinandens oplysninger.",
  },
  {
    title: "Hvis du er politi eller forhandler",
    body: "Slå nummeret op og se om genstanden er meldt savnet eller stjålet af sin ejer.",
  },
];

type Match = {
  item_id: string;
  name: string;
  description: string | null;
  status: "registered" | "lost" | "stolen";
  brand: string | null;
  category: string | null;
  status_changed_at: string | null;
  image_paths: string[];
};

const dk = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("da-DK", { dateStyle: "long" }) : "";

/** Søg på serienummer */
export default async function SerialLookupPage({ searchParams }: PageProps<"/serienummer">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  let match: Match | null = null;
  let imageUrls: string[] = [];

  if (query.length > 0) {
    const supabase = await createClient();
    // lookup_serial er security definer og matcher kun eksakt. Den
    // returnerer intet om ejeren — se migrationen for begrundelsen.
    const { data } = await supabase.rpc("lookup_serial", {
      raw_serial: query,
    });
    match = (data as Match[] | null)?.[0] ?? null;

    // Bucket'en er public, så URL'erne kan bygges uden signering.
    imageUrls = (match?.image_paths ?? []).map(
      (path) =>
        supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl,
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <h1 className="font-display text-[32px] font-normal text-navy">
            Slå et serienummer op
          </h1>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-body">
            Se om en genstand er registreret i Ejendelsregisteret, og om ejeren
            har meldt den savnet eller stjålet.
          </p>

          <form action="/serienummer" role="search" className="mt-6 flex gap-2">
            <label htmlFor="serie-q" className="sr-only">
              Serienummer
            </label>
            <input
              id="serie-q"
              name="q"
              type="search"
              defaultValue={query}
              autoFocus
              placeholder="F.eks. WTU-2310 04568"
              className="h-11 flex-1 rounded-sm border border-line bg-white px-5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange"
            />
            <button
              type="submit"
              className="h-11 rounded-sm bg-orange px-7 text-[16px] font-medium text-white transition-colors hover:bg-orange-dark"
            >
              Søg
            </button>
          </form>

          <p className="mt-3 text-[13px] text-muted">
            Bindestreger, mellemrum og store/små bogstaver er uden betydning.
            Nummeret skal derimod være fuldstændigt — der søges ikke på dele
            af et serienummer.
          </p>

          {query.length === 0 && (
            <ol className="mt-10 grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-3">
              {USES.map((use) => (
                <li key={use.title} className="bg-white px-5 py-5">
                  <h2 className="font-display text-[17px] font-normal text-navy">
                    {use.title}
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-[1.7] text-body">
                    {use.body}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {query.length > 0 && (
            <div className="mt-8">
              {!match ? (
                <div className="rounded-sm border border-line bg-white p-8 text-center">
                  <SearchX
                    className="mx-auto size-8 text-muted"
                    strokeWidth={1.5}
                  />
                  <p className="mt-4 font-display text-[21px] text-navy">
                    Ingen registreret ejendel
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-body">
                    Der er ingen ejendel registreret med serienummeret{" "}
                    <span className="font-mono text-navy">{query}</span>.
                    Kontrollér at nummeret er skrevet helt korrekt — også de
                    sidste cifre.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-sm border border-line bg-white">
                  {match.status === "registered" && (
                    <div className="flex gap-4 p-6">
                      <CircleCheck
                        className="mt-0.5 size-6 shrink-0 text-emerald-600"
                        strokeWidth={2}
                      />
                      <div>
                        <p className="font-display text-[21px] text-navy">
                          Ejendelen er registreret
                        </p>
                        <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">
                          Serienummeret findes i Ejendelsregisteret og er ikke
                          meldt savnet eller stjålet.
                        </p>
                      </div>
                    </div>
                  )}

                  {match.status !== "registered" && (
                    <div
                      className={`flex gap-4 p-6 ${
                        match.status === "stolen"
                          ? "bg-red-50/60"
                          : "bg-amber-50/60"
                      }`}
                    >
                      {match.status === "stolen" ? (
                        <ShieldAlert
                          className="mt-0.5 size-6 shrink-0 text-red-600"
                          strokeWidth={2}
                        />
                      ) : (
                        <TriangleAlert
                          className="mt-0.5 size-6 shrink-0 text-amber-600"
                          strokeWidth={2}
                        />
                      )}
                      <div>
                        <p className="font-display text-[21px] text-navy">
                          {match.status === "stolen"
                            ? "Meldt stjålet"
                            : "Meldt savnet"}
                        </p>
                        <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">
                          Ejeren har markeret denne ejendel som{" "}
                          {match.status === "stolen" ? "stjålet" : "savnet"}
                          {match.status_changed_at &&
                            ` den ${dk(match.status_changed_at)}`}
                          . Har du fundet den, kan du hjælpe ejeren med at få
                          den tilbage.
                        </p>
                      </div>
                    </div>
                  )}

                  {imageUrls.length > 0 && (
                    <ul className="flex flex-wrap gap-3 border-t border-line px-6 py-5">
                      {imageUrls.map((url, i) => (
                        <li
                          key={url}
                          className="relative size-28 overflow-hidden rounded-sm bg-mist"
                        >
                          <Image
                            src={url}
                            alt={`${match.name} billede ${i + 1}`}
                            fill
                            sizes="112px"
                            className="object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}

                  <dl className="border-t border-line px-6 py-4 text-[14px]">
                    <div className="flex gap-4 py-1">
                      <dt className="w-28 shrink-0 text-muted">Ejendel</dt>
                      <dd className="font-semibold text-navy">{match.name}</dd>
                    </div>
                    <div className="flex gap-4 py-1">
                      <dt className="w-28 shrink-0 text-muted">Serienummer</dt>
                      <dd className="font-mono text-navy">{query}</dd>
                    </div>
                    {match.brand && (
                      <div className="flex gap-4 py-1">
                        <dt className="w-28 shrink-0 text-muted">Mærke</dt>
                        <dd className="text-navy">{match.brand}</dd>
                      </div>
                    )}
                    {match.category && (
                      <div className="flex gap-4 py-1">
                        <dt className="w-28 shrink-0 text-muted">Kategori</dt>
                        <dd className="text-navy">{match.category}</dd>
                      </div>
                    )}
                    {match.description && (
                      <div className="flex gap-4 py-1">
                        <dt className="w-28 shrink-0 text-muted">
                          Beskrivelse
                        </dt>
                        <dd className="text-navy">{match.description}</dd>
                      </div>
                    )}
                  </dl>

                  <p className="border-t border-line bg-mist px-6 py-4 text-[13px] leading-relaxed text-muted">
                    Sammenlign oplysningerne med den genstand du har.
                    Stemmer de ikke, er det ikke den samme ejendel.
                    <br />
                    Vi viser hverken ejerens navn, kontaktoplysninger eller
                    kvitteringer — kontakt til ejeren sker gennem
                    Ejendelsregisteret.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
