import { Layers } from "lucide-react";

export function SerialSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.22em] text-muted">
            Serienummer&nbsp;&nbsp; Dokumentation&nbsp;&nbsp; Ejerskab
          </p>
          <span className="mt-4 block h-0.5 w-12 bg-orange" />

          <h2 className="mt-6 font-display text-[42px] leading-[1.15] font-normal text-navy">
            Alt med serienummer &mdash;
            <br />
            samlet <em className="font-accent text-orange">ét sted</em>
          </h2>

          <p className="mt-6 max-w-md text-[16px] leading-[1.75] text-body">
            Telefonen, cyklen i kælderen, boremaskinen, kameraet og uret. Har
            den et serienummer, hører den til her &mdash; og det tager to
            minutter pr. ting. Sælger du den videre, følger ejerskabet med til
            køberen.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="/bliv-medlem"
              className="inline-flex h-11 items-center rounded-sm bg-orange px-7 text-[16px] font-medium text-white transition-colors hover:bg-orange-dark"
            >
              Kom i gang
            </a>
            <a
              href="/priser"
              className="inline-flex h-11 items-center rounded-sm border border-line px-7 text-[16px] font-medium text-navy transition-colors hover:border-navy"
            >
              Se priser
            </a>
          </div>
        </div>

        {/* Foto med flydende kort */}
        <div className="relative">
          <div className="photo-sofa aspect-[4/3] w-full rounded-sm" />
        </div>
      </div>
    </section>
  );
}
