import Link from "next/link";

/**
 * Byggeklodser til guiden.
 *
 * Guiden er lang, og en lang side står og falder med om man kan skimme
 * den. Derfor faste afsnit med ankre, så indholdsfortegnelsen og de gamle
 * URL'er kan pege direkte ned i det afsnit der svarer på spørgsmålet.
 */

export type Chapter = { id: string; title: string };

/** Indholdsfortegnelse. Ankrene skal matche id'erne på afsnittene. */
export function TableOfContents({ chapters }: { chapters: Chapter[] }) {
  return (
    <nav
      aria-label="Indhold"
      className="rounded-sm border border-line bg-white p-5 sm:p-6"
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-navy">
        Indhold
      </p>
      <ol className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
        {chapters.map((chapter, index) => (
          <li key={chapter.id} className="flex gap-2.5">
            <span className="text-[13px] font-bold text-orange tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Link
              href={`#${chapter.id}`}
              className="text-[14.5px] text-body transition-colors hover:text-orange"
            >
              {chapter.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Section({
  id,
  n,
  title,
  lead,
  children,
}: {
  id: string;
  n: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    // scroll-mt holder overskriften fri af toppen når man hopper hertil.
    <section id={id} className="scroll-mt-8">
      <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-orange">
        Trin {String(n).padStart(2, "0")}
      </p>
      <h2 className="mt-2 font-display text-[26px] leading-tight font-bold text-navy sm:text-[30px]">
        {title}
      </h2>
      {lead && (
        <p className="mt-3 text-[16px] leading-[1.75] text-navy">{lead}</p>
      )}
      <div className="mt-4 space-y-4 text-[15.5px] leading-[1.75] text-body">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-2.5 size-1 shrink-0 rounded-full bg-orange" />
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Det man skal standse op ved. */
export function Callout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border-l-2 border-orange bg-white px-5 py-4">
      {title && (
        <p className="text-[14px] font-bold text-navy">{title}</p>
      )}
      <div className="text-[15px] leading-[1.7] text-body">{children}</div>
    </div>
  );
}

/**
 * Hvor serienummeret sidder, pr. genstand.
 *
 * Tabellen scroller vandret i sin egen kasse på smalle skærme. Uden det
 * ville hele siden kunne skubbes sidelæns på en telefon.
 */
export function WhereTable({
  rows,
}: {
  rows: { item: string; where: string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-white">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-mist/60">
            <th className="px-5 py-3 text-[13px] font-semibold text-navy">
              Genstand
            </th>
            <th className="px-5 py-3 text-[13px] font-semibold text-navy">
              Hvor står nummeret
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.item} className="border-b border-line last:border-0">
              <td className="px-5 py-3 text-[14.5px] font-semibold text-navy">
                {row.item}
              </td>
              <td className="px-5 py-3 text-[14.5px] leading-relaxed text-body">
                {row.where}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
