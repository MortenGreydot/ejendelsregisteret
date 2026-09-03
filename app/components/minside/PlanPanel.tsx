"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { invokeFunction } from "@/lib/functions";

import { DeleteAccount } from "./DeleteAccount";

/**
 * Medlemskabet på Min side: hvad man har, og hvad man kan gøre ved det.
 *
 * Opsigelsen er to trin i selve panelet frem for en confirm()-boks.
 * Browserens dialog kan hverken formuleres ordentligt eller sige hvad der
 * rent faktisk sker — og "OK/Annuller" er den værst tænkelige måde at
 * spørge om noget der koster kunden deres medlemskab. Her står betingelsen
 * skrevet, og knapperne siger hvad de gør.
 *
 * Opsigelse er ikke endelig: Stripe lader abonnementet løbe perioden ud, og
 * indtil da kan det genoptages. Derfor viser panelet tilstanden "opsagt,
 * men aktiv indtil den dato" — det er den tilstand mailens knap "Fortryd
 * opsigelsen" fører hen til.
 */
export function PlanPanel({
  planName,
  includedItems,
  monthlyPrice,
  nextPayment,
  hasSubscription,
  cancelAtPeriodEnd,
  itemCount,
}: {
  planName: string;
  includedItems: number;
  monthlyPrice: number | null;
  nextPayment: string | null;
  hasSubscription: boolean;
  /** Opsagt, men løber til nextPayment. Status er stadig aktiv indtil da. */
  cancelAtPeriodEnd: boolean;
  itemCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "cancel" | "resume") {
    setPending(true);
    setError(null);
    setMessage(null);

    const { error: callError } = await invokeFunction<{
      cancelAtPeriodEnd?: boolean;
    }>("manage-subscription", { action });

    setPending(false);

    if (callError) {
      setError(callError);
      return;
    }

    setConfirming(false);
    setMessage(
      action === "cancel"
        ? "Medlemskabet er opsagt og løber perioden ud."
        : "Medlemskabet er genoptaget. Det fortsætter som før.",
    );
    // Serveren har den nye tilstand; panelet tegnes om ud fra den frem for
    // at gætte den her.
    router.refresh();
  }

  return (
    <div className="flex flex-col justify-between space-y-4">
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
            {monthlyPrice?.toLocaleString("da-DK") ?? "0"} kr.
            <span className="text-[13px] font-normal text-muted">/md.</span>
          </p>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-[14px] text-muted">
          {cancelAtPeriodEnd ? "Adgang til og med" : "Næste betaling"}:{" "}
          <strong className="font-semibold text-navy">
            {nextPayment ?? "Ingen planlagt"}
          </strong>
        </p>

        {cancelAtPeriodEnd && (
          <p className="mt-4 rounded-sm border border-amber-300 bg-amber-50/70 px-3.5 py-3 text-[13.5px] leading-relaxed text-body">
            <strong className="font-semibold text-navy">
              Dit medlemskab er opsagt.
            </strong>{" "}
            Du har fuld adgang{nextPayment ? ` frem til ${nextPayment}` : " perioden ud"}.
            Derefter kan du stadig se og hente dine ejendele, men ikke oprette
            nye. Du kan genoptage det når som helst inden da.
          </p>
        )}
      </div>

      <div>
        {hasSubscription && cancelAtPeriodEnd && (
          <button
            type="button"
            onClick={() => send("resume")}
            disabled={pending}
            className="h-11 w-full rounded-sm bg-orange text-[15px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-60"
          >
            {pending ? "Genoptager…" : "Genoptag medlemskab"}
          </button>
        )}

        {hasSubscription && !cancelAtPeriodEnd && !confirming && (
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setMessage(null);
              setError(null);
            }}
            className="h-11 w-full rounded-sm border border-orange bg-white text-[15px] font-medium text-orange transition-colors hover:bg-orange hover:text-white"
          >
            Opsig abonnement
          </button>
        )}

        {hasSubscription && !cancelAtPeriodEnd && confirming && (
          <div className="rounded-sm border border-line bg-mist p-4">
            <p className="text-[14px] leading-relaxed text-body">
              <strong className="font-semibold text-navy">
                Vil du opsige dit medlemskab?
              </strong>{" "}
              Det løber til{" "}
              {nextPayment ? (
                <strong className="font-semibold text-navy">
                  {nextPayment}
                </strong>
              ) : (
                "udgangen af den betalte periode"
              )}
              , som du allerede har betalt for. Indtil da kan du fortryde igen
              her på siden.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => send("cancel")}
                disabled={pending}
                className="h-11 flex-1 rounded-sm border border-orange bg-white px-5 text-[15px] font-medium text-orange transition-colors hover:bg-orange hover:text-white disabled:opacity-60"
              >
                {pending ? "Opsiger…" : "Ja, opsig"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="h-11 flex-1 rounded-sm bg-navy px-5 text-[15px] font-bold text-white transition-colors hover:bg-navy/90 disabled:opacity-60"
              >
                Behold medlemskabet
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role="status" className="mt-3 text-center text-[14px] text-body">
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-sm border border-red-200 bg-red-50 px-3.5 py-2.5 text-[14px] text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-4 border-t border-line pt-4">
          <DeleteAccount itemCount={itemCount} />
        </div>
      </div>
    </div>
  );
}
