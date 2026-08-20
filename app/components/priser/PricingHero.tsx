"use client";

import { useState } from "react";

import { PLANS, STEPS, type PlanId } from "@/lib/plans";

import { useAudience } from "../AudienceProvider";
import { PlanCard } from "./PlanCard";

export function PricingHero() {
  const { audience } = useAudience();
  const [pending, setPending] = useState(false);
  const plan = PLANS[audience];

  async function handleSelect(planId: PlanId) {
    setPending(true);

    // TODO Stripe: POST { planId } til en route handler, der slår price-id'et
    // op server-side, opretter en Checkout Session og returnerer session.url.
    // Prisen må aldrig komme fra klienten.
    //
    //   const res = await fetch("/api/checkout", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ planId }),
    //   });
    //   const { url } = await res.json();
    //   window.location.href = url;

    console.info("Checkout endnu ikke koblet på Stripe:", planId);
    setPending(false);
  }

  return (
    <section className="bg-mist">
      <div className="mx-auto max-w-4xl px-6 py-20 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange">
          {plan.eyebrow}
        </p>
        <h1 className="mt-4 font-display text-[34px] font-bold text-navy">
          {plan.headline}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[13px] leading-[1.7] text-body">
          {plan.intro}
        </p>

        <div className="mt-10 flex justify-center">
          <PlanCard plan={plan} onSelect={handleSelect} pending={pending} />
        </div>

        <h2 className="mt-16 font-display text-[22px] font-normal text-navy">
          Sådan fungerer det
        </h2>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-sm border border-line bg-white px-4 py-6 text-center"
            >
              <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-[12px] font-bold text-navy">
                {step.title}
              </p>
              <p className="mt-1 text-[11px] text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
