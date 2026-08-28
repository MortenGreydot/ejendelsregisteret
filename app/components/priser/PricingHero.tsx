"use client";

import { useState } from "react";

import { invokeFunction } from "@/lib/functions";
import { PLANS, STEPS, type PlanId } from "@/lib/plans";

import { useAudience } from "../AudienceProvider";
import { PlanCard } from "./PlanCard";

export function PricingHero({
  hasSubscription,
}: {
  hasSubscription: boolean;
}) {
  const { audience } = useAudience();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plan = PLANS[audience];

  async function handleSelect(planId: PlanId) {
    setPending(true);
    setError(null);

    // Kun planId sendes. Price-id'et slås op i funktionens egen env, så
    // prisen ikke kan ændres i devtools inden checkout oprettes.
    const { data, error: callError } = await invokeFunction<{ url?: string }>(
      "create-checkout",
      { planId },
    );

    if (callError || !data?.url) {
      setError(callError ?? "Kunne ikke starte betaling.");
      setPending(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <section className="bg-mist">
      <div className="mx-auto max-w-4xl px-6 py-10 text-center">
        <h1 className=" font-display text-[36px] font-bold text-navy">
          {plan.headline}
        </h1>

        <div className="mt-4 flex justify-center">
          <PlanCard
            plan={plan}
            onSelect={handleSelect}
            pending={pending}
            hasSubscription={hasSubscription}
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-[14px] text-red-600">
            {error}
          </p>
        )}

        <h2 className="mt-8 font-display text-[24px] font-normal text-navy">
          Sådan fungerer det
        </h2>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-sm border border-line bg-white px-4 py-6 text-center"
            >
              <span className="mx-auto flex size-8 items-center justify-center rounded-full bg-navy text-[15px] font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-[14px] font-bold text-navy">
                {step.title}
              </p>
              <p className="mt-1 text-[13px] text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
