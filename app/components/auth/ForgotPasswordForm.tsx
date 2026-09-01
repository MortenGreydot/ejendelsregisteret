"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { userMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

const fieldClass =
  "mt-2 h-11 w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

/**
 * Beder Supabase sende et nulstillingslink.
 *
 * Kvitteringen er den samme uanset om adressen findes hos os eller ej.
 * Sagde vi "den mail kender vi ikke", ville formularen kunne bruges til at
 * afprøve hvem der har en konto — og det er en oplysning vi ikke skylder
 * nogen. Supabase svarer af samme grund heller ikke forskelligt selv.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const email = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      // Adressen skal stå på Supabases liste over tilladte redirects,
      // ellers sender de brugeren til Site URL i stedet.
      { redirectTo: `${window.location.origin}/nulstil-adgangskode` },
    );

    setPending(false);

    // Kun tekniske fejl vises. At adressen ikke findes er ikke en fejl her.
    if (resetError) {
      setError(
        userMessage(
          resetError,
          "Vi kunne ikke sende linket. Prøv igen om lidt.",
        ),
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-10 text-center">
        <MailCheck className="mx-auto size-7 text-emerald-600" strokeWidth={1.75} />
        <p className="mt-4 font-display text-[21px] text-navy">
          Tjek din indbakke
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-body">
          Findes der en konto med den adresse, ligger der nu en mail med et
          link til at vælge en ny adgangskode. Linket virker i en time.
        </p>
        <p className="mt-4 text-[13px] text-muted">
          Ingen mail? Se i spamfilteret, eller{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-orange underline underline-offset-4 hover:text-orange-dark"
          >
            prøv en anden adresse
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-line bg-white p-6 sm:p-8"
    >
      <label htmlFor="nulstil-email" className="block text-[14px] font-semibold text-navy">
        Din e-mail
      </label>
      <input
        id="nulstil-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        disabled={pending}
        placeholder="din@mail.dk"
        className={fieldClass}
      />

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-sm border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 h-11 w-full rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
      >
        {pending ? "Sender…" : "Send mig et link"}
      </button>

      <p className="mt-4 text-center text-[13px] text-muted">
        Kom du i tanke om den?{" "}
        <Link
          href="/"
          className="font-medium text-orange underline underline-offset-4 hover:text-orange-dark"
        >
          Tilbage til forsiden
        </Link>
      </p>
    </form>
  );
}
