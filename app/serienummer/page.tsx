import type { Metadata } from "next";
import { SearchX, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { MatchCard, type Match } from "../components/serienummer/MatchCard";

export const metadata: Metadata = {
  title: "Serienummer | Ejendelsregisteret",
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
    body: "Står nummeret registreret, kan du skrive til ejeren gennem os. Du får ikke deres oplysninger, men de kan svare dig direkte.",
  },
  {
    title: "Hvis du er politi eller forhandler",
    body: "Slå nummeret op og se om genstanden er meldt savnet eller stjålet af sin ejer.",
  },
];

/** Søg på serienummer */
export default async function SerialLookupPage({
  searchParams,
}: PageProps<"/serienummer">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  let matches: Match[] = [];
  /** Billed-URL'er pr. ejendel. Bucket'en er public, så de kan bygges direkte. */
  let imageUrls: Record<string, string[]> = {};
  // Skal holdes adskilt fra "ingen træffer". Fejler opslaget, må vi ikke
  // svare "ikke registreret" — så ville en finder få at vide at genstanden
  // er fri, fordi vores database var nede.
  let lookupFailed = false;

  if (query.length > 0) {
    const supabase = await createClient();
    // lookup_serial er security definer og matcher kun eksakt. Den
    // returnerer intet om ejeren — se migrationen for begrundelsen.
    const { data, error } = await supabase.rpc("lookup_serial", {
      raw_serial: query,
    });

    if (error) {
      console.error("lookup_serial:", error);
      lookupFailed = true;
    }

    // Alle træffere, ikke kun den første. Databasen sorterer stjålet og
    // savnet øverst, så det vigtigste står forrest.
    matches = (data as Match[] | null) ?? [];

    imageUrls = Object.fromEntries(
      matches.map((m) => [
        m.item_id,
        m.image_paths.map(
          (path) =>
            supabase.storage.from("item-images").getPublicUrl(path).data
              .publicUrl,
        ),
      ]),
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-2xl px-6 py-8">
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
            Nummeret skal derimod være fuldstændigt. Der søges ikke på dele
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
              {lookupFailed ? (
                <div className="rounded-sm border border-line bg-white p-8 text-center">
                  <TriangleAlert
                    className="mx-auto size-8 text-orange"
                    strokeWidth={1.5}
                  />
                  <p className="mt-4 font-display text-[21px] text-navy">
                    Vi kunne ikke slå op lige nu
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-body">
                    Der er noget galt i vores ende. Det betyder ikke at
                    serienummeret er ukendt. Prøv igen om et øjeblik.
                  </p>
                </div>
              ) : matches.length === 0 ? (
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
                    Kontrollér at nummeret er skrevet helt korrekt, også de
                    sidste cifre.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/*
                    Flere træffere er ikke en fejl. Serienumre er ikke
                    globalt unikke, så finderen skal selv kunne se hvilken
                    af dem der matcher genstanden i hånden.
                  */}
                  {matches.length > 1 && (
                    <p className="rounded-sm border border-line bg-white px-5 py-4 text-[14px] leading-relaxed text-body">
                      <span className="font-semibold text-navy">
                        {matches.length} ejendele
                      </span>{" "}
                      er registreret med serienummeret{" "}
                      <span className="font-mono text-navy">{query}</span>.
                      Serienumre går igen på tværs af mærker og produkter, så
                      sammenlign oplysningerne nedenfor med det du har i hånden.
                    </p>
                  )}

                  {matches.map((m) => (
                    <MatchCard
                      key={m.item_id}
                      match={m}
                      imageUrls={imageUrls[m.item_id] ?? []}
                      query={query}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
