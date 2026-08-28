/**
 * Tallene stammer fra DI Byggeris analyse (2026) og er verificeret mod
 * artiklen. Kildeangivelsen står under blokken — påstande om en hel branche
 * skal kunne dokumenteres, ikke bare lyde rigtige.
 *
 * "1 ud af 3" gælder DI Byggeris medlemsvirksomheder, ikke håndværks-
 * virksomheder generelt. Derfor står kilden med, så udsagnet ikke bliver
 * bredere end grundlaget.
 */
const stats = [
  { value: "278 mio. kr.", label: "Taber byggebranchen årligt på tyveri" },
  { value: "1 ud af 3", label: "Virksomheder rammes direkte af tyveri" },
  {
    value: "15 om dagen",
    label: "Indbrud i varebiler og på byggepladser",
  },
];

const SOURCE_URL =
  "https://www.danskindustri.dk/brancher/di-byggeri/nyheder/arkiv/nyheder/2026/2/det-skal-vare-svarere-at-vare-tyv--og-lettere-at-vare-handvarker/";

export function BusinessHero() {
  return (
    <section className="photo-tools">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="inline-block rounded-sm bg-orange px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white">
          For håndværkere &amp; entreprenører
        </p>

        <h1 className="mt-6 font-display text-[46px] leading-[1.1] font-normal text-white">
          Værktøj &amp; udstyr
          <br />
          <em className="font-accent text-orange">samlet ét sted</em>
        </h1>

        <p className="mt-6 max-w-lg text-[16px] leading-[1.75] text-white/80">
          Boremaskiner, kompressorer, lasere og elværktøj. Registrér
          serienumrene, gem kvitteringerne og tag billederne &mdash; klar til
          forsikring, tyveri og transport.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <a
            href="#"
            className="inline-flex h-11 items-center rounded-sm bg-orange px-7 text-[16px] font-medium text-white transition-colors hover:bg-orange-dark"
          >
            Opret virksomhedsprofil
          </a>
          <a
            href="/priser"
            className="inline-flex h-11 items-center rounded-sm border border-white/40 bg-navy/70 px-7 text-[16px] font-medium text-white transition-colors hover:bg-navy"
          >
            Se pris for erhverv
          </a>
        </div>

        <dl className="mt-14 grid max-w-2xl gap-8 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="font-display text-[26px] font-bold text-white">
                {stat.value}
              </dt>
              <dd className="mt-1 text-[13px] leading-snug text-white/60">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-[12px] text-white/45">
          Kilde:{" "}
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-white/70"
          >
            DI Byggeri, 2026
          </a>
        </p>
      </div>
    </section>
  );
}
