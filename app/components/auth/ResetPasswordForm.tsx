"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { userMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/client";

const MIN_LENGTH = 8;

const fieldClass =
  "mt-2 h-11 w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

type Phase = "tjekker" | "klar" | "ugyldig" | "gemt";

/**
 * Vælger en ny adgangskode.
 *
 * Siden kan nås ad to veje, og begge skal virke:
 *
 *   1. /auth/confirm har allerede vekslet linket til en session på serveren.
 *      Så er der ingenting i URL'en, og sessionen ligger i en cookie.
 *   2. Supabase har sendt brugeren hertil med ?code= i adressen. Så skal
 *      koden veksles her i browseren.
 *
 * Vej 1 er den robuste: vej 2 kræver at mailen åbnes i samme browser som
 * anmodningen blev sendt fra, fordi PKCE-verifieren ligger lokalt. Beder
 * man om nulstilling på telefonen og åbner mailen på computeren, virker
 * kun vej 1.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("tjekker");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Vekslingen må kun ske én gang. En kode kan ikke bruges to gange. */
  const exchanged = useRef(false);

  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const supabase = createClient();
    const code = new URLSearchParams(window.location.search).get("code");

    async function verify() {
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        // Koden ud af adresselinjen, så et genindlæst vindue ikke prøver
        // at bruge den igen — og så den ikke havner i browserhistorikken.
        window.history.replaceState({}, "", "/nulstil-adgangskode");

        setPhase(exchangeError ? "ugyldig" : "klar");
        return;
      }

      // Ingen kode: så skal /auth/confirm have lavet sessionen for os.
      const { data } = await supabase.auth.getClaims();
      setPhase(data?.claims ? "klar" : "ugyldig");
    }

    verify();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const password = String(form.get("adgangskode") ?? "");
    const repeat = String(form.get("gentag") ?? "");

    if (password.length < MIN_LENGTH) {
      setError(
        `Adgangskoden skal være mindst ${MIN_LENGTH} tegn. Flere ord i træk er både nemmere at huske og sværere at gætte.`,
      );
      return;
    }

    if (password !== repeat) {
      setError("De to adgangskoder er ikke ens.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(
        userMessage(updateError, "Adgangskoden kunne ikke ændres. Prøv igen."),
      );
      return;
    }

    setPhase("gemt");
    router.refresh();
  }

  if (phase === "tjekker") {
    return (
      <p className="rounded-sm border border-line bg-white px-6 py-10 text-center text-[15px] text-muted">
        Tjekker linket…
      </p>
    );
  }

  if (phase === "ugyldig") {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-10 text-center">
        <TriangleAlert
          className="mx-auto size-7 text-orange"
          strokeWidth={1.75}
        />
        <p className="mt-4 font-display text-[21px] text-navy">
          Linket virker ikke længere
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-body">
          Et nulstillingslink holder en time og kan kun bruges én gang. Er du
          kommet hertil på anden vis, skal du bede om et nyt.
        </p>
        <Link
          href="/glemt-adgangskode"
          className="mt-6 inline-flex h-11 items-center rounded-sm bg-orange px-6 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark"
        >
          Bed om et nyt link
        </Link>
      </div>
    );
  }

  if (phase === "gemt") {
    return (
      <div className="rounded-sm border border-line bg-white px-6 py-10 text-center">
        <p className="mt-4 font-display text-[21px] text-navy">
          Adgangskoden er ændret
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] leading-relaxed text-body">
          Du er logget ind med det samme. Næste gang bruger du den nye kode.
        </p>
        <Link
          href="/min-side"
          className="mt-6 inline-flex h-11 items-center rounded-sm bg-orange px-6 text-[15px] font-bold text-white transition-colors hover:bg-orange-dark"
        >
          Gå til min side
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-line bg-white p-6 sm:p-8"
    >
      <div>
        <label
          htmlFor="ny-adgangskode"
          className="block text-[14px] font-semibold text-navy"
        >
          Ny adgangskode
        </label>
        <input
          id="ny-adgangskode"
          name="adgangskode"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          disabled={pending}
          placeholder="••••••••"
          className={fieldClass}
        />
        <p className="mt-1.5 text-[12.5px] text-muted">
          Mindst {MIN_LENGTH} tegn.
        </p>
      </div>

      <div className="mt-4">
        <label
          htmlFor="gentag-adgangskode"
          className="block text-[14px] font-semibold text-navy"
        >
          Gentag adgangskoden
        </label>
        <input
          id="gentag-adgangskode"
          name="gentag"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          placeholder="••••••••"
          className={fieldClass}
        />
      </div>

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
        {pending ? "Gemmer…" : "Gem ny adgangskode"}
      </button>
    </form>
  );
}
