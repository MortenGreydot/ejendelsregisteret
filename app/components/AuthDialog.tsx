"use client";

import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

const fieldClass =
  "h-11 w-full rounded-sm border border-line px-3.5 text-[13px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[12px] font-semibold text-navy";

export function AuthDialog() {
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
          setError(error.message);
          return;
        }
        close();
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Kun visningsnavn. Brug aldrig user_metadata til autorisation —
          // brugeren kan selv redigere det.
          data: { full_name: String(form.get("navn")) },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        close();
        router.refresh();
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
        className="rounded-sm border border-white/35 px-3.5 py-1.5 text-[13px] transition-colors hover:border-white hover:bg-white/10"
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
            <p className="font-display text-[16px] font-bold tracking-tight text-navy">
              Ejendelsregisteret
            </p>
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-orange">
              Dækker alt &ndash; over alt
            </p>
          </div>

          <h2
            id="auth-dialog-title"
            className="mt-7 text-center font-display text-[26px] font-normal text-navy"
          >
            {isLogin ? "Log ind" : "Opret konto"}
          </h2>

          {!isLogin && (
            <p className="mt-1.5 text-center text-[12px] text-muted">
              99 kr. oprettelse &middot; 29 kr./md. &middot; 25 ejendele inkl.
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
                <a
                  href="#"
                  className="text-[11px] font-medium text-orange hover:text-orange-dark"
                >
                  Glemt adgangskode?
                </a>
              </div>
            )}

            {error && (
              <p role="alert" className="text-[12px] leading-snug text-red-600">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="text-[12px] leading-snug text-navy">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-orange text-[14px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
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

          <p className="mt-5 text-center text-[12px] text-muted">
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
