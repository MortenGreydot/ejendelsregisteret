"use client";

import { useState } from "react";

import { invokeFunction } from "@/lib/functions";

import { useAudience } from "./AudienceProvider";

const fieldClass =
  "w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[14px] font-semibold text-navy";

/**
 * Navnet skal se tillokkende ud for en bot, men ikke kollidere med et
 * rigtigt felt — og heller ikke med et felt browseren selv vil udfylde.
 *
 * Feltet hed "website" indtil 2026-09-01. Både autofyld og enhver
 * adgangskodemanager genkender "website" som URL-feltet på et login og
 * udfylder det uden at spørge. Lod den besøgende sin manager udfylde navn
 * og mail, røg fælden med, og formularen kvitterede med "tak for din
 * besked" uden at sende noget. Se ContactOwner.tsx — samme fejl stod der.
 */
const HONEYPOT_FIELD = "kontakt_ref";

export function ContactForm() {
  const { isErhverv } = useAudience();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    // Honeypot: feltet er usynligt for mennesker, så alt indhold er en bot.
    // Vi viser samme kvittering som ved en rigtig indsendelse — ellers kan
    // botten se at den blev afvist og prøve igen uden fælden. Feltet sendes
    // med til serveren, som fanger det samme; en bot der poster direkte til
    // funktionen kommer aldrig forbi den her linje.
    if (String(form.get(HONEYPOT_FIELD) ?? "").trim() !== "") {
      setSent(true);
      setPending(false);
      return;
    }

    const { data, error: callError } = await invokeFunction<{ sent?: boolean }>(
      "send-contact",
      {
        name: String(form.get("navn") ?? ""),
        company: String(form.get("virksomhed") ?? ""),
        email: String(form.get("email") ?? ""),
        subject: String(form.get("emne") ?? ""),
        message: String(form.get("besked") ?? ""),
        [HONEYPOT_FIELD]: String(form.get(HONEYPOT_FIELD) ?? ""),
      },
    );

    setPending(false);

    // Kvitteringen vises kun hvis beskeden faktisk kom afsted. Ellers
    // sidder folk og venter på et svar på noget vi aldrig har modtaget.
    if (callError || !data?.sent) {
      setError(
        callError ??
          "Beskeden kunne ikke sendes. Prøv igen, eller skriv direkte til kontakt@ejendelsregisteret.dk.",
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-8 text-center">
        <p className="font-display text-[22px] text-navy">Tak for din besked</p>
        <p className="mt-2 text-[15px] text-body">
          Vi vender tilbage hurtigst muligt.
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
          className="mt-5 text-[14px] font-medium text-orange hover:text-orange-dark"
        >
          Skriv en ny besked
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative space-y-4">
      {/*
        Honeypot. Skubbes ud af viewporten frem for display:none, som en del
        bots springer over. aria-hidden + tabIndex={-1} holder den væk fra
        skærmlæsere og tab-rækkefølgen.
      */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="kontakt-ref">Reference</label>
        {/*
          autoComplete="off" alene er ikke nok — adgangskodemanagere
          ignorerer den. data-1p-ignore (1Password), data-lpignore
          (LastPass) og data-form-type="other" (Dashlane, Bitwarden) er de
          attributter de faktisk retter sig efter.
        */}
        <input
          id="kontakt-ref"
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
      </div>

      <div>
        <label htmlFor="kontakt-navn" className={labelClass}>
          Navn
        </label>
        <input
          id="kontakt-navn"
          name="navn"
          type="text"
          autoComplete="name"
          required
          disabled={pending}
          placeholder="Dit navn"
          className={`mt-2 h-11 ${fieldClass}`}
        />
      </div>

      {isErhverv && (
        <div>
          <label htmlFor="kontakt-virksomhed" className={labelClass}>
            Virksomhed
          </label>
          <input
            id="kontakt-virksomhed"
            name="virksomhed"
            type="text"
            autoComplete="organization"
            required
            disabled={pending}
            placeholder="Virksomhedens navn"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </div>
      )}

      <div>
        <label htmlFor="kontakt-email" className={labelClass}>
          E-mail
        </label>
        <input
          id="kontakt-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          placeholder="din@mail.dk"
          className={`mt-2 h-11 ${fieldClass}`}
        />
      </div>

      <div>
        <label htmlFor="kontakt-emne" className={labelClass}>
          Emne
        </label>
        <input
          id="kontakt-emne"
          name="emne"
          type="text"
          required
          disabled={pending}
          placeholder="Hvad handler det om?"
          className={`mt-2 h-11 ${fieldClass}`}
        />
      </div>

      <div>
        <label htmlFor="kontakt-besked" className={labelClass}>
          Besked
        </label>
        <textarea
          id="kontakt-besked"
          name="besked"
          rows={5}
          required
          disabled={pending}
          placeholder="Skriv din besked her…"
          className={`mt-2 resize-y py-3 ${fieldClass}`}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 px-3.5 py-3 text-[14px] text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
      >
        {pending ? "Sender…" : "Send besked"}
      </button>
    </form>
  );
}
