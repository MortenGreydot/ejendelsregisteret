import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { vatLabel, type Plan } from "@/lib/plans";

const USPS = [
  "Klar til forsikringen",
  "Findbar hvis den forsvinder",
  "Overdrages ved salg",
];

export function Hero({ plan }: { plan: Plan }) {
  return (
    <section className="photo-hero">
      <div className="mx-auto max-w-3xl px-6 py-8 text-center">
        <p className="mb-2 font-display text-[20px] text-white/60">
          Inventarlisten{" "}
          <em className="font-accent pr-[0.14em] text-orange">en del af</em>{" "}
          Ejendelsregisteret
        </p>

        <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-orange">
          Dækker alt, over alt
        </p>

        <h1 className="mt-2 font-display text-[46px] leading-[1.1] font-normal text-white sm:text-[56px]">
          Bevis at dine ting er
          <br />
          <em className="font-accent text-orange"> dine</em>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-[1.6] text-white/85">
          Serienummer, kvittering og billeder samlet ét sted. Opret dig og dine
          ting, og se din inventarliste på Min side.
        </p>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-white/70">
          {USPS.map((usp) => (
            <li key={usp} className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-orange" />
              {usp}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/bliv-medlem"
            className="inline-flex h-12 items-center gap-2 rounded-sm bg-orange px-8 text-[16px] font-bold text-white transition-colors hover:bg-orange-dark"
          >
            Kom i gang
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="/priser"
            className="inline-flex h-12 items-center rounded-sm border border-white/40 px-8 text-[16px] font-medium text-white transition-colors hover:border-white hover:bg-white/10"
          >
            Se priser
          </Link>
        </div>

        <p className="mt-5 text-[13px] text-white/55">
          {plan.setupFee} kr. i oprettelse &middot; {plan.monthlyPrice} kr./md.
          &middot; {plan.includedItems} ejendele inkluderet &middot; opsig når
          som helst &middot; {vatLabel(plan)}
        </p>

        <p className="mt-8 border-t border-white/15 pt-5 text-[14px] text-white/60">
          Har du fundet noget?{" "}
          <Link
            href="/serienummer"
            className="font-semibold text-white underline underline-offset-4 hover:text-orange"
          >
            Slå serienummeret op
          </Link>
        </p>
      </div>
    </section>
  );
}
