import { Layers } from "lucide-react";

export function SerialSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
            Serienummer&nbsp;&nbsp; Dokumentation&nbsp;&nbsp; Ejerskab
          </p>
          <span className="mt-4 block h-0.5 w-12 bg-orange" />

          <h2 className="mt-6 font-display text-[40px] leading-[1.15] font-normal text-navy">
            Alt med serienummer &mdash;
            <br />
            samlet <em className="font-accent text-orange">ét sted</em>
          </h2>

          <p className="mt-6 max-w-md text-[14px] leading-[1.75] text-body">
            Din telefon, din laptop, cyklen i kælderen, kameraet og dit ur.
            Registrér serienummeret og gem kvitteringen &mdash; så du har
            beviset klart den dag du har brug for det.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex h-11 items-center rounded-sm bg-orange px-6 text-[14px] font-medium text-white transition-colors hover:bg-orange-dark"
            >
              Kom i gang
            </a>
            <a
              href="#"
              className="inline-flex h-11 items-center rounded-sm border border-line px-6 text-[14px] font-medium text-navy transition-colors hover:border-navy"
            >
              Se priser
            </a>
          </div>
        </div>

        {/* Foto med flydende kort */}
        <div className="relative">
          <div className="photo-sofa aspect-[4/3] w-full rounded-sm" />
          <div className="absolute bottom-5 left-5 flex items-center gap-3 rounded-sm bg-white px-4 py-3 shadow-lg shadow-navy/10">
            <span className="flex size-9 items-center justify-center rounded-sm bg-navy">
              <Layers className="size-4.5 text-white" strokeWidth={1.75} />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-navy">
                Mine Ting
              </span>
              <span className="block text-[11px] text-muted">
                25 ejendele registreret
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
