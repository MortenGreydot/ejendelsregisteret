"use client";

import { useState } from "react";

import { useAudience } from "./AudienceProvider";

const fieldClass =
  "w-full rounded-sm border border-line bg-white px-3.5 text-[13px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[12px] font-semibold text-navy";

// Navnet skal se tillokkende ud for en bot, men ikke kollidere med et rigtigt felt.
const HONEYPOT_FIELD = "website";

export function ContactForm() {
  const { isErhverv } = useAudience();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const form = new FormData(event.currentTarget);

    // Honeypot: feltet er usynligt for mennesker, så alt indhold er en bot.
    // Vi viser samme kvittering som ved en rigtig indsendelse — ellers kan
    // botten se at den blev afvist og prøve igen uden fælden.
    if (String(form.get(HONEYPOT_FIELD) ?? "").trim() !== "") {
      setSent(true);
      setPending(false);
      return;
    }

    // TODO: ingen modtager endnu — formen sender ikke videre nogen steder.
    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-8 text-center">
        <p className="font-display text-[20px] text-navy">Tak for din besked</p>
        <p className="mt-2 text-[13px] text-body">
          Vi vender tilbage hurtigst muligt.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-5 text-[12px] font-medium text-orange hover:text-orange-dark"
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
        <label htmlFor="kontakt-website">Website</label>
        <input
          id="kontakt-website"
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
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

      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-sm bg-orange text-[14px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
      >
        {pending ? "Sender…" : "Send besked"}
      </button>
    </form>
  );
}
