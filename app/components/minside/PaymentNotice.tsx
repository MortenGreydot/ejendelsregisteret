"use client";

import { CreditCard, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { invokeFunction } from "@/lib/functions";
import type { PlanId } from "@/lib/plans";

import type { SubscriptionStatus } from "@/lib/subscription";

export type { SubscriptionStatus };

/**
 * Forklarer hvorfor medlemskabet ikke er aktivt, og tilbyder at prøve igen.
 *
 * Teksten er delt op pr. status, fordi årsagerne kræver forskellige svar:
 * en afbrudt betaling er brugerens eget valg, en fejlet betaling er typisk
 * kortet, og et opsagt abonnement er en beslutning der skal gøres om.
 */
/** "none" dækker at der slet ikke findes en abonnementsrække. */
type NoticeKey =
  | "pending_activation"
  | "past_due"
  | "canceled"
  | "expired"
  | "none";

const MESSAGES: Record<
  NoticeKey,
  { title: string; body: string; cta: string }
> = {
  pending_activation: {
    title: "Betalingen blev ikke gennemført",
    body: "Din konto er oprettet, men medlemskabet er ikke aktivt endnu. Du kan ikke oprette ejendele, før betalingen er gået igennem.",
    cta: "Gennemfør betaling",
  },
  past_due: {
    title: "Din seneste betaling mislykkedes",
    body: "Vi kunne ikke trække beløbet. Det skyldes oftest et udløbet kort eller manglende dækning. Dine ejendele er bevaret, men du kan ikke oprette nye.",
    cta: "Prøv betalingen igen",
  },
  canceled: {
    title: "Dit medlemskab er opsagt",
    body: "Du har stadig adgang til dine registrerede ejendele, men du kan ikke oprette nye. Tegn et nyt medlemskab for at fortsætte.",
    cta: "Tegn medlemskab igen",
  },
  expired: {
    title: "Dit medlemskab er udløbet",
    body: "Du har stadig adgang til dine registrerede ejendele, men du kan ikke oprette nye.",
    cta: "Tegn medlemskab igen",
  },
  none: {
    title: "Du har ikke et aktivt medlemskab",
    body: "Opret et medlemskab for at kunne registrere dine ejendele.",
    cta: "Vælg medlemskab",
  },
};

export function PaymentNotice({
  status,
  planId,
}: {
  status: SubscriptionStatus;
  planId: PlanId;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "active") return null;

  const message = MESSAGES[status ?? "none"];

  async function retry() {
    setPending(true);
    setError(null);

    const { data, error: callError } = await invokeFunction<{ url?: string }>(
      "create-checkout",
      { planId, cancelTo: "min-side" },
    );

    if (callError || !data?.url) {
      setError(callError ?? "Kunne ikke starte betalingen.");
      setPending(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <section
      role="alert"
      className="mb-8 rounded-sm border border-l-4 border-amber-400 border-y-line border-r-line bg-amber-50/60 p-4 sm:p-5"
    >
      <div className="flex gap-3 sm:gap-4">
        <TriangleAlert
          className="mt-0.5 size-5 shrink-0 text-amber-600"
          strokeWidth={2}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-navy">{message.title}</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-body">
            {message.body}
          </p>

          {error && (
            <p className="mt-2 text-[14px] text-red-600">{error}</p>
          )}

          <button
            type="button"
            onClick={retry}
            disabled={pending}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-orange px-6 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70 sm:h-10 sm:w-auto"
          >
            <CreditCard className="size-4" strokeWidth={2} />
            {pending ? "Sender dig videre…" : message.cta}
          </button>
        </div>
      </div>
    </section>
  );
}
