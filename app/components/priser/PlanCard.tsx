import { Check, Plus } from "lucide-react";

import type { Plan } from "@/lib/plans";

export function PlanCard({
  plan,
  onSelect,
  pending,
}: {
  plan: Plan;
  onSelect: (planId: Plan["id"]) => void;
  pending: boolean;
}) {
  const dark = plan.theme === "dark";

  return (
    <div
      className={
        dark
          ? "w-full max-w-sm rounded-sm bg-navy px-8 py-8 shadow-xl shadow-navy/20"
          : "w-full max-w-sm rounded-sm bg-white px-8 py-8 shadow-xl shadow-navy/10"
      }
    >
      <p
        className={`font-display text-[20px] font-bold ${dark ? "text-white" : "text-navy"}`}
      >
        {plan.name}
      </p>
      <p className={`mt-1 text-[12px] ${dark ? "text-white/65" : "text-muted"}`}>
        {plan.tagline}
      </p>

      <p className="mt-6 flex items-baseline gap-1.5">
        <span
          className={`text-[40px] leading-none font-bold ${dark ? "text-white" : "text-navy"}`}
        >
          {plan.monthlyPrice}
        </span>
        <span
          className={`text-[13px] font-medium ${dark ? "text-white/80" : "text-navy"}`}
        >
          kr./md.
        </span>
      </p>
      <p className="mt-2 text-[11px] text-orange">
        + {plan.setupFee} kr. ved oprettelse (én gang)
      </p>

      <p
        className={`mt-4 flex items-center gap-2 rounded-sm px-3 py-2.5 text-[11px] ${
          dark ? "bg-white/10 text-white/85" : "bg-mist text-body"
        }`}
      >
        <Plus className="size-3.5 shrink-0 text-orange" strokeWidth={2.5} />
        {plan.includedItems} ejendele inkluderet &middot; ekstra ejendele{" "}
        {plan.extraItemPrice} kr./stk./md.
      </p>

      <ul className="mt-5 space-y-2.5">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className={`flex items-start gap-2.5 text-[12px] ${dark ? "text-white/85" : "text-body"}`}
          >
            <Check
              className="mt-0.5 size-3.5 shrink-0 text-orange"
              strokeWidth={3}
            />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        disabled={pending}
        className={`mt-7 h-11 w-full rounded-sm text-[13px] font-bold text-white transition-colors disabled:opacity-70 ${
          dark ? "bg-orange hover:bg-orange-dark" : "bg-navy hover:bg-navy/90"
        }`}
      >
        {pending ? "Et øjeblik…" : "Kom i gang"}
      </button>

      <p
        className={`mt-3 text-center text-[10px] ${dark ? "text-white/50" : "text-muted"}`}
      >
        Betaling via Stripe &middot; Opsig når som helst
      </p>
    </div>
  );
}
