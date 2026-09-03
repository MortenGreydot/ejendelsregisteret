"use client";

import Link from "next/link";

/**
 * Afkrydsningsfeltet for handelsbetingelserne.
 *
 * Ét sted, fordi det skal stå foran hver eneste betaling: oprettelsen, det
 * separate betalingstrin for den der allerede er logget ind, prissiden og
 * påmindelsen på Min side. Stod teksten fire steder, ville den blive rettet
 * ét af dem den dag betingelserne ændrer sig.
 *
 * Linket åbner i ny fane med vilje. Et almindeligt klik ville forlade siden
 * midt i en halvt udfyldt formular, og så er navn, mail og adgangskode væk
 * når man kommer tilbage.
 *
 * `required` gør browseren til det første værn: i en rigtig <form> kan der
 * ikke sendes uden fluebenet, og browseren peger selv på feltet. Uden for en
 * form gør attributten ingenting, og der skal kalderen selv spærre knappen —
 * se `startCheckout` i SignupFlow.
 */
export function AcceptTerms({
  id,
  checked,
  onChange,
  disabled = false,
  className = "",
}: {
  /** Skal være unikt på siden — feltet optræder flere steder i samme flow. */
  id: string;
  checked: boolean;
  onChange: (accepted: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 text-left ${className}`}>
      <input
        id={id}
        name="handelsbetingelser"
        type="checkbox"
        required
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-orange disabled:cursor-not-allowed disabled:opacity-60"
      />
      <label
        htmlFor={id}
        className="cursor-pointer text-[13.5px] leading-relaxed text-body"
      >
        Jeg accepterer{" "}
        <Link
          href="/handelsbetingelser"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-orange underline underline-offset-2 hover:text-orange-dark"
        >
          handelsbetingelserne
        </Link>
      </label>
    </div>
  );
}

/**
 * Fejlen der vises hvis nogen alligevel nåede forbi fluebenet.
 *
 * Neutralt formuleret, fordi feltet både står foran en betaling og foran en
 * ren kontooprettelse. "Før du betaler" ville være forkert det ene sted.
 */
export const TERMS_REQUIRED =
  "Sæt flueben ved handelsbetingelserne for at fortsætte.";
