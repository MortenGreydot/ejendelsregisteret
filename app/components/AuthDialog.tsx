"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { userMessage } from "@/lib/errors";

import { useAudience } from "./AudienceProvider";

type Mode = "login" | "signup";

const fieldClass =
  "h-11 w-full rounded-sm border border-line px-5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[14px] font-semibold text-navy";

export function AuthDialog() {
  const { isErhverv } = useAudience();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isLogin = mode === "login";

  function open() {
    reset("login");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  /**
   * Sender brugeren til sin profil efter login eller oprettelse.
   *
   * refresh() efter push() er nødvendig: Navbar og /min-side er server-
   * komponenter der læser sessionen fra cookies. Uden refresh genbruger
   * Next den cachede server-render fra før login, så siden ville vise
   * "Log ind" og redirecte tilbage til forsiden.
   */
  function redirectToProfile() {
    router.push("/min-side");
    router.refresh();
  }

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("adgangskode"));
    const supabase = createClient();

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(userMessage(error, "Vi kunne ikke logge dig ind. Prøv igen."));
          return;
        }
        close();
        redirectToProfile();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Metadata bliver til raw_user_meta_data, som triggeren kopierer
          // over i profiles. Brugeren kan selv redigere de her felter, så de
          // må aldrig bruges til autorisation — kun som stamdata.
          data: {
            full_name: String(form.get("navn")),
            account_type: isErhverv ? "business" : "private",
            ...(isErhverv
              ? {
                  company_name: String(form.get("virksomhed") ?? ""),
                  cvr_number: String(form.get("cvr") ?? ""),
                }
              : {}),
          },
        },
      });

      if (error) {
        setError(
          userMessage(error, "Kontoen kunne ikke oprettes. Prøv igen."),
        );
        return;
      }

      if (data.session) {
        close();
        redirectToProfile();
        return;
      }

      // E-mailbekræftelse er slået til på projektet.
      setNotice(
        "Vi har sendt dig en bekræftelsesmail. Åbn linket for at aktivere din konto.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-sm border border-white/35 px-5 py-1.5 text-[15px] transition-colors hover:border-white hover:bg-white/10"
      >
        Log ind
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="auth-dialog-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-sm border-0 bg-transparent p-0 backdrop:bg-[#3d3d3d]/85"
      >
        <div className="relative rounded-sm bg-white px-10 pt-10 pb-9">
          <button
            type="button"
            onClick={close}
            aria-label="Luk"
            className="absolute top-4 right-4 text-muted transition-colors hover:text-navy"
          >
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>

          {/* Brand */}
          <div className="text-center">
            <p className="font-display text-[18px] font-bold tracking-tight text-navy">
              Ejendelsregisteret
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange">
              Dækker alt, over alt
            </p>
          </div>

          <h2
            id="auth-dialog-title"
            className="mt-7 text-center font-display text-[28px] font-normal text-navy"
          >
            {isLogin ? "Log ind" : "Opret konto"}
          </h2>

          {!isLogin && (
            <p className="mt-1.5 text-center text-[14px] text-muted">
              99 kr. oprettelse &middot; 29 kr./md. &middot; 5 ejendele inkl.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="auth-name" className={labelClass}>
                  Fulde navn
                </label>
                <input
                  id="auth-name"
                  name="navn"
                  type="text"
                  autoComplete="name"
                  required
                  disabled={pending}
                  placeholder="Hans Hansen"
                  className={`mt-2 ${fieldClass}`}
                />
              </div>
            )}

            {!isLogin && isErhverv && (
              <>
                <div>
                  <label htmlFor="auth-company" className={labelClass}>
                    Virksomhed
                  </label>
                  <input
                    id="auth-company"
                    name="virksomhed"
                    type="text"
                    autoComplete="organization"
                    required
                    disabled={pending}
                    placeholder="Virksomhedens navn"
                    className={`mt-2 ${fieldClass}`}
                  />
                </div>

                <div>
                  <label htmlFor="auth-cvr" className={labelClass}>
                    CVR-nummer
                  </label>
                  <input
                    id="auth-cvr"
                    name="cvr"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{8}"
                    title="CVR-nummer er 8 cifre"
                    required
                    disabled={pending}
                    placeholder="12345678"
                    className={`mt-2 ${fieldClass}`}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className={labelClass}>
                E-mailadresse
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                placeholder="dig@eksempel.dk"
                className={`mt-2 ${fieldClass}`}
              />
            </div>

            <div>
              <label htmlFor="auth-password" className={labelClass}>
                Adgangskode
              </label>
              <input
                id="auth-password"
                name="adgangskode"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                minLength={6}
                disabled={pending}
                placeholder="••••••••"
                className={`mt-2 ${fieldClass}`}
              />
            </div>

            {isLogin && (
              <div className="text-right">
                <Link
                  href="/glemt-adgangskode"
                  onClick={close}
                  className="text-[13px] font-medium text-orange hover:text-orange-dark"
                >
                  Glemt adgangskode?
                </Link>
              </div>
            )}

            {error && (
              <p role="alert" className="text-[14px] leading-snug text-red-600">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="text-[14px] leading-snug text-navy">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
            >
              {pending ? (
                "Vent venligst…"
              ) : isLogin ? (
                "Log ind"
              ) : (
                <>
                  Fortsæt
                  <ArrowRight className="size-4" strokeWidth={2.25} />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-[14px] text-muted">
            {isLogin ? "Har du ikke en konto? " : "Har du allerede en konto? "}
            <button
              type="button"
              onClick={() => reset(isLogin ? "signup" : "login")}
              className="font-bold text-orange transition-colors hover:text-orange-dark"
            >
              {isLogin ? "Opret konto" : "Log ind"}
            </button>
          </p>
        </div>
      </dialog>
    </>
  );
}
