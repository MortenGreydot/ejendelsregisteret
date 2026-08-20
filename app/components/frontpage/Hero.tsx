import { Search } from "lucide-react";

const quickLinks = [
  { label: "Hvad er ejendelsregisteret?", href: "#" },
  { label: "Sådan virker det", href: "#" },
  { label: "Se priser", href: "#" },
];

export function Hero() {
  return (
    <section className="photo-hero">
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h1 className="font-display text-5xl font-normal tracking-tight text-white sm:text-[54px]">
          Ejendelsregisteret
        </h1>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-orange">
          Dækker alt &mdash; over alt
        </p>
        <p className="mt-6 text-[15px] text-white/85">
          Danmarks digitale tingbog for værdigenstande.
        </p>

        <form
          action="#"
          className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row"
        >
          <label htmlFor="hero-serial" className="sr-only">
            Serienummer
          </label>
          <input
            id="hero-serial"
            name="serienummer"
            type="search"
            placeholder="Indtast serienummer…"
            className="h-11 w-full rounded-sm bg-white px-4 text-[14px] text-navy placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange sm:w-[320px]"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-orange px-6 text-[14px] font-medium text-white transition-colors hover:bg-orange-dark"
          >
            <Search className="size-4" strokeWidth={2} />
            Søg
          </button>
        </form>

        <nav className="mt-7 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[12px] text-white/70">
          {quickLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="underline underline-offset-4 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
