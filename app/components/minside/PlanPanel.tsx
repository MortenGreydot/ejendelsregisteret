"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { DeleteAccount } from "./DeleteAccount";

export function PlanPanel({
  planName,
  includedItems,
  monthlyPrice,
  nextPayment,
  hasSubscription,
  itemCount,
}: {
  planName: string;
  includedItems: number;
  monthlyPrice: number | null;
  nextPayment: string | null;
  hasSubscription: boolean;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancel() {
    if (
      !confirm(
        "Opsig abonnementet? Det løber til udgangen af den betalte periode.",
      )
    )
      return;

    setPending(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<{
      cancelAtPeriodEnd?: boolean;
      error?: string;
    }>("manage-subscription", { body: { action: "cancel" } });

    setPending(false);

    if (error || data?.error) {
      setMessage(data?.error ?? "Kunne ikke opsige abonnementet.");
      return;
    }
    setMessage("Abonnementet er opsagt og løber perioden ud.");
    router.refresh();
  }

  return (
    <div className="space-y-4 flex justify-between flex-col">
      <div className="h-full rounded-sm border border-line bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[20px] font-bold text-navy">
              {planName}
            </p>
            <p className="mt-0.5 text-[14px] text-muted">
              {includedItems} ejendele inkluderet
            </p>
          </div>
          <p className="shrink-0 text-[26px] font-bold text-navy">
            {monthlyPrice?.toLocaleString("da-DK") ?? "—"} kr.
            <span className="text-[13px] font-normal text-muted">/md.</span>
          </p>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[14px] text-muted">
          Næste betaling:{" "}
          <strong className="font-semibold text-navy">
            {nextPayment ?? "—"}
          </strong>
        </p>
      </div>
      <div>
        {hasSubscription && (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="h-11 w-full rounded-sm border border-orange bg-white text-[15px] font-medium text-orange transition-colors hover:bg-orange hover:text-white disabled:opacity-60"
          >
            {pending ? "Opsiger…" : "Opsig abonnement"}
          </button>
        )}

        {message && (
          <p role="status" className="text-center text-[14px] text-body">
            {message}
          </p>
        )}

        <div className="border-t border-line pt-4">
          <DeleteAccount itemCount={itemCount} />
        </div>
      </div>
    </div>
  );
}
