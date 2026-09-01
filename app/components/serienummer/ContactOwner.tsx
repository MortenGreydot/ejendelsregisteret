"use client";

import { Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { invokeFunction } from "@/lib/functions";

/** Skal matche HONEYPOT i contact-owner/index.ts. */
const HONEYPOT = "website";

const fieldClass =
  "w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[14px] font-semibold text-navy";

/**
 * Lader en finder skrive til ejeren gennem Ejendelsregisteret.
 *
 * Kontakten er ensrettet med vilje. Finderen ser aldrig ejerens adresse og
 * kan kun skrive herigennem; ejeren får finderens og kan svare direkte. En
 * fremmed skal ikke kunne åbne en kanal ind til en anden borger — men den
 * der har mistet noget skal kunne handle med det samme.
 *
 * Formularen er skjult indtil man trykker. Er man kommet for at tjekke et
 * serienummer inden man køber brugt, skal der ikke stå en skrivedialog og
 * fylde — og en synlig formular indbyder til at blive udfyldt af vane.
 */
export function ContactOwner({
  itemId,
  itemName,
  status,
}: {
  itemId: string;
  itemName: string;
  status: "registered" | "lost" | "stolen";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);

    const { data, error: callError } = await invokeFunction<{ sent?: boolean }>(
      "contact-owner",
      {
        itemId,
        name: String(form.get("navn") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("telefon") ?? ""),
        message: String(form.get("besked") ?? ""),
        [HONEYPOT]: String(form.get(HONEYPOT) ?? ""),
      },
    );

    setPending(false);

    if (callError || !data?.sent) {
      setError(
        callError ??
          "Beskeden kunne ikke sendes. Prøv igen, eller skriv til kontakt@ejendelsregisteret.dk.",
      );
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="border-t border-line bg-emerald-50/60 px-6 py-6 text-center">
        <ShieldCheck
          className="mx-auto size-6 text-emerald-600"
          strokeWidth={2}
        />
        <p className="mt-3 font-display text-[19px] text-navy">
          Din besked er sendt
        </p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-body">
          Vi har givet den videre til ejeren sammen med din mailadresse, så de
          kan svare dig direkte. Du har ikke fået deres, så vil du skrive igen,
          går det gennem os.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="border-t border-line px-6 py-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center gap-2 rounded-sm bg-orange px-6 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark"
        >
          <Mail className="size-4" strokeWidth={2.5} />
          Kontakt ejeren
        </button>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted">
          Beskeden går gennem Ejendelsregisteret. Ejeren får din mailadresse, så
          de kan svare dig. Du får ikke deres, og du kan kun skrive til dem
          herigennem.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line px-6 py-6">
      <p className="font-display text-[19px] text-navy">
        Skriv til ejeren af {itemName}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Vi sender beskeden videre. Skriv hvad det drejer sig om, og hvordan I
        bedst kan mødes om en aflevering.
      </p>

      <form onSubmit={handleSubmit} className="relative mt-5 space-y-4">
        {/* Honeypot — se ContactForm for hvorfor den skubbes ud af skærmen. */}
        <div
          aria-hidden="true"
          className="absolute left-[-9999px] h-px w-px overflow-hidden"
        >
          <label htmlFor="ejer-website">Website</label>
          <input
            id="ejer-website"
            name={HONEYPOT}
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="ejer-navn" className={labelClass}>
            Dit navn
          </label>
          <input
            id="ejer-navn"
            name="navn"
            type="text"
            autoComplete="name"
            required
            disabled={pending}
            placeholder="Dit navn"
            className={`mt-2 h-11 ${fieldClass}`}
          />
        </div>

        <div>
          <label htmlFor="ejer-email" className={labelClass}>
            Din e-mail
          </label>
          <input
            id="ejer-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={pending}
            placeholder="din@mail.dk"
            className={`mt-2 h-11 ${fieldClass}`}
          />
          <p className="mt-1.5 text-[12.5px] text-muted">
            Ejeren får din adresse, så de kan svare dig direkte. Vi bruger den
            ikke til andet.
          </p>
        </div>

        <div>
          <label htmlFor="ejer-telefon" className={labelClass}>
            Telefon <span className="font-normal text-muted">(valgfrit)</span>
          </label>
          <input
            id="ejer-telefon"
            name="telefon"
            type="tel"
            autoComplete="tel"
            disabled={pending}
            placeholder="12 34 56 78"
            className={`mt-2 h-11 ${fieldClass}`}
          />
          <p className="mt-1.5 text-[12.5px] text-muted">
            Gives også videre til ejeren, hvis du hellere vil ringes op.
          </p>
        </div>

        <div>
          <label htmlFor="ejer-besked" className={labelClass}>
            Besked
          </label>
          <textarea
            id="ejer-besked"
            name="besked"
            rows={5}
            required
            disabled={pending}
            placeholder="Fx: Jeg har fundet den ved Nørreport i går. Den står i god behold, og jeg kan aflevere den efter kl. 16."
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

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-11 flex-1 rounded-sm bg-orange px-6 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
          >
            {pending ? "Sender…" : "Send til ejeren"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="h-11 rounded-sm border border-line px-6 text-[15px] font-medium text-body transition-colors hover:border-navy hover:text-navy disabled:opacity-60"
          >
            Fortryd
          </button>
        </div>
      </form>
    </div>
  );
}
