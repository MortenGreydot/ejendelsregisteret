export function ProtectBanner() {
  return (
    <section className="photo-protect">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-lg">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/70">
            Tryghed &middot; Sikkerhed &middot; Overblik
          </p>

          <h2 className="mt-6 font-display text-[40px] leading-[1.15] font-normal text-white">
            Når uheldet er ude,
            <br />
            <em className="font-accent text-orange">er du klar.</em>
          </h2>

          <p className="mt-6 text-[14px] leading-[1.75] text-white/80">
            Indbrud, brand og tyveri &mdash; uanset hvad sker, med serienumre,
            kvitteringer og billeder registreret har du dokumentationen til
            forsikringen.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#"
              className="inline-flex h-11 items-center rounded-sm bg-orange px-6 text-[14px] font-medium text-white transition-colors hover:bg-orange-dark"
            >
              Beskyt dine ting
            </a>
            <a
              href="#"
              className="inline-flex h-11 items-center rounded-sm border border-white/40 bg-navy/70 px-6 text-[14px] font-medium text-white transition-colors hover:bg-navy"
            >
              Se hvordan det virker
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
