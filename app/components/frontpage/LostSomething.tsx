import { ArrowRight } from "lucide-react";

export function LostSomething() {
  return (
    <section className="bg-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-[28px] font-normal text-navy">
            Mistet noget?
          </h2>
          <p className="mt-4 text-[13px] leading-[1.8] text-body">
            Ejendelsregisteret samarbejder med{" "}
            <strong className="font-semibold text-navy">
              Hittegodscentralen.dk
            </strong>{" "}
            &mdash; Danmarks nationale hittegodsdatabase. Når du har mistet
            noget, kan du oprette en efterlysning der, og vi krydstjekker
            automatisk mod dit register.
          </p>
        </div>

        <a
          href="#"
          className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-sm bg-orange px-6 text-[14px] font-medium text-white transition-colors hover:bg-orange-dark lg:self-auto"
        >
          Søg på Hittegodscentralen
          <ArrowRight className="size-4" strokeWidth={2} />
        </a>
      </div>
    </section>
  );
}
