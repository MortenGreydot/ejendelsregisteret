import { LEGAL_UPDATED } from "@/lib/legal";

import { Navbar } from "../Navbar";

/**
 * Fælles ramme om de tre juridiske sider.
 *
 * Typografien defineres ét sted, så politikkerne ser ens ud. Målet er
 * læsbarhed frem for pynt: en smal spalte, luft mellem afsnittene og
 * tydelige overskrifter, så man kan skimme efter det afsnit man leder efter.
 */
export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="font-display text-[30px] leading-tight font-normal text-navy sm:text-[38px]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-body">{intro}</p>
          <p className="mt-4 text-[13px] text-muted">
            Sidst opdateret: {LEGAL_UPDATED}
          </p>

          <div className="mt-10 space-y-9">{children}</div>
        </div>
      </main>
    </>
  );
}

/** Ét nummereret afsnit. */
export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-[21px] font-bold text-navy">
        {n}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-body">
        {children}
      </div>
    </section>
  );
}

/** Punktopstilling med orange prikker, så den matcher resten af sitet. */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-orange" />
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Fremhævet boks til det der er værd at standse op ved. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border-l-2 border-orange bg-white px-4 py-3 text-[14.5px] leading-relaxed text-body">
      {children}
    </p>
  );
}
