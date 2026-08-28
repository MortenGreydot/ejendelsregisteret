"use client";

import { ArrowRight, Check, Mail } from "lucide-react";
import { useState } from "react";

import { invokeFunction } from "@/lib/functions";
import { createClient } from "@/lib/supabase/client";
import { PLANS, vatLabel, type PlanId } from "@/lib/plans";

import { useAudience, type Audience } from "../AudienceProvider";

const fieldClass =
  "mt-2 h-11 w-full rounded-sm border border-line bg-white px-5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";
const labelClass = "block text-[14px] font-semibold text-navy";

type Step = "plan" | "konto" | "betaling" | "bekraeft";

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: "plan", label: "Vælg medlemskab" },
  { id: "konto", label: "Opret konto" },
  { id: "betaling", label: "Betaling" },
];

/**
 * Skifter mellem privat og erhverv direkte i brødteksten.
 *
 * Samme kilde som knapperne i navbaren — begge kalder setAudience, så der
 * ikke opstår to steder valget kan stå forskelligt.
 */
function AudienceLink({
  target,
  current,
  onSelect,
  children,
}: {
  target: Audience;
  current: Audience;
  onSelect: (audience: Audience) => void;
  children: React.ReactNode;
}) {
  const active = target === current;

  return (
    <button
      type="button"
      onClick={() => onSelect(target)}
      aria-pressed={active}
      className={
        active
          ? "font-semibold text-orange underline underline-offset-4"
          : "font-semibold text-navy underline underline-offset-4 transition-colors hover:text-orange"
      }
    >
      {children}
    </button>
  );
}

export function SignupFlow({
  signedIn,
  skipPlanStep = false,
}: {
  signedIn: boolean;
  /** Sat når brugeren kommer fra prissiden, hvor planen allerede er valgt. */
  skipPlanStep?: boolean;
}) {
  // Medlemskabet ER audience-valget. Havde flowet sin egen planId-tilstand,
  // kunne de to nå at pege forskellige steder hen — fx hvis man skiftede i
  // navbaren midt i forløbet.
  const { audience, setAudience } = useAudience();
  const planId: PlanId = audience;
  const plan = PLANS[planId];

  const [step, setStep] = useState<Step>(
    skipPlanStep ? (signedIn ? "betaling" : "konto") : "plan",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choosePlan() {
    // Er man logget ind, er kontotrinnet overflødigt.
    setStep(signedIn ? "betaling" : "konto");
  }

  /**
   * Opretter kontoen og sender brugeren videre til betaling i ét forløb.
   *
   * signUp returnerer kun en session hvis e-mailbekræftelse er slået fra.
   * Er den slået til, forsøges et login — det fejler med `email_not_confirmed`,
   * og så er der ingen vej udenom: create-checkout kræver et gyldigt token,
   * og et token kræver en bekræftet konto. I det tilfælde vises
   * bekræftelsestrinnet i stedet.
   */
  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("adgangskode"));
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: String(form.get("navn")),
          account_type: planId === "erhverv" ? "business" : "private",
          ...(planId === "erhverv"
            ? {
                company_name: String(form.get("virksomhed") ?? ""),
                cvr_number: String(form.get("cvr") ?? ""),
              }
            : {}),
        },
      },
    });

    if (signUpError) {
      setPending(false);
      setError(signUpError.message);
      return;
    }

    let session = data.session;

    // Kom der ingen session med oprettelsen, så prøv at logge ind.
    if (!session) {
      const { data: login, error: loginError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setPending(false);
        // Kontoen ER oprettet — den skal bare bekræftes først.
        setStep("bekraeft");
        return;
      }
      session = login.session;
    }

    if (!session) {
      setPending(false);
      setStep("bekraeft");
      return;
    }

    // Sessionen er på plads, så tokenet kan bruges med det samme.
    await startCheckout();
  }

  /** Opretter Checkout-sessionen og sender brugeren til Stripe. */
  async function startCheckout() {
    setPending(true);
    setError(null);

    const { data, error: callError } = await invokeFunction<{ url?: string }>(
      "create-checkout",
      { planId, cancelTo: "bliv-medlem" },
    );

    if (callError || !data?.url) {
      setError(callError ?? "Kunne ikke starte betalingen.");
      setPending(false);
      return;
    }

    window.location.href = data.url;
  }

  const activeIndex = STEP_LABELS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-2xl">
      {step !== "bekraeft" && (
        <ol className="flex items-center justify-center gap-2 text-[13px]">
          {STEP_LABELS.map((s, i) => {
            const done = i < activeIndex;
            const current = i === activeIndex;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-[12px] font-bold ${
                    done
                      ? "bg-orange text-white"
                      : current
                        ? "bg-navy text-white"
                        : "bg-line text-muted"
                  }`}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                </span>
                <span className={current ? "text-navy" : "text-muted"}>
                  {s.label}
                </span>
                {i < STEP_LABELS.length - 1 && (
                  <span className="mx-1 h-px w-6 bg-line" />
                )}
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-4">
        {step === "plan" && (
          <>
            <p className="text-center text-[15px] text-body">
              Skift mellem{" "}
              <AudienceLink
                target="privat"
                current={audience}
                onSelect={setAudience}
              >
                Privat
              </AudienceLink>{" "}
              og{" "}
              <AudienceLink
                target="erhverv"
                current={audience}
                onSelect={setAudience}
              >
                Erhverv
              </AudienceLink>
            </p>

            <div className="mx-auto mt-8 max-w-sm rounded-sm border border-line bg-white p-8">
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-orange">
                {plan.eyebrow}
              </p>
              <p className="mt-3 font-display text-[24px] font-bold text-navy">
                {plan.name}
              </p>
              <p className="mt-0.5 text-[14px] text-muted">{plan.tagline}</p>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[40px] leading-none font-bold text-navy">
                  {plan.monthlyPrice}
                </span>
                <span className="text-[15px] font-medium text-navy">
                  kr./md.
                </span>
              </p>
              <p className="mt-1.5 text-[13px] text-orange">
                + {plan.setupFee} kr. ved oprettelse (én gang)
              </p>
              <p className="mt-1 text-[12px] text-muted">
                Alle priser {vatLabel(plan)}
              </p>

              <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[14px] text-body"
                  >
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-orange"
                      strokeWidth={3}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={choosePlan}
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark"
              >
                Vælg {plan.name}
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </>
        )}

        {step === "konto" && (
          <form
            onSubmit={createAccount}
            className="rounded-sm border border-line bg-white p-8"
          >
            <h1 className="font-display text-[26px] font-normal text-navy">
              Opret din konto
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              {plan.name} &middot; {plan.monthlyPrice} kr./md. + {plan.setupFee}{" "}
              kr. ved oprettelse
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="flow-navn" className={labelClass}>
                  Fulde navn
                </label>
                <input
                  id="flow-navn"
                  name="navn"
                  required
                  disabled={pending}
                  placeholder="Hans Hansen"
                  className={fieldClass}
                />
              </div>

              {planId === "erhverv" && (
                <>
                  <div>
                    <label htmlFor="flow-virksomhed" className={labelClass}>
                      Virksomhed
                    </label>
                    <input
                      id="flow-virksomhed"
                      name="virksomhed"
                      required
                      disabled={pending}
                      autoComplete="organization"
                      placeholder="Virksomhedens navn"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="flow-cvr" className={labelClass}>
                      CVR-nummer
                    </label>
                    <input
                      id="flow-cvr"
                      name="cvr"
                      required
                      disabled={pending}
                      inputMode="numeric"
                      pattern="\d{8}"
                      title="CVR-nummer er 8 cifre"
                      placeholder="12345678"
                      className={fieldClass}
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="flow-email" className={labelClass}>
                  E-mailadresse
                </label>
                <input
                  id="flow-email"
                  name="email"
                  type="email"
                  required
                  disabled={pending}
                  autoComplete="email"
                  placeholder="dig@eksempel.dk"
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="flow-kode" className={labelClass}>
                  Adgangskode
                </label>
                <input
                  id="flow-kode"
                  name="adgangskode"
                  type="password"
                  required
                  minLength={6}
                  disabled={pending}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={fieldClass}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-4 text-[14px] text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-6 h-11 w-full rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
            >
              {pending ? "Opretter konto…" : "Fortsæt til betaling"}
            </button>

            <button
              type="button"
              onClick={() => setStep("plan")}
              className="mt-3 w-full text-[14px] text-muted hover:text-navy"
            >
              Tilbage til valg af medlemskab
            </button>
          </form>
        )}

        {step === "betaling" && (
          <div className="rounded-sm border border-line bg-white p-8 text-center">
            <h1 className="font-display text-[26px] font-normal text-navy">
              Bekræft dit medlemskab
            </h1>

            <dl className="mx-auto mt-6 max-w-xs space-y-2 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-muted">Medlemskab</dt>
                <dd className="font-semibold text-navy">{plan.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Pr. måned</dt>
                <dd className="font-semibold text-navy">
                  {plan.monthlyPrice} kr.
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Oprettelse (én gang)</dt>
                <dd className="font-semibold text-navy">{plan.setupFee} kr.</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-semibold text-navy">I dag</dt>
                <dd className="font-bold text-navy">
                  {plan.monthlyPrice + plan.setupFee} kr.
                </dd>
              </div>
              <p className="pt-1 text-right text-[12px] text-muted">
                {vatLabel(plan)}
              </p>
            </dl>

            {error && (
              <p role="alert" className="mt-5 text-[14px] text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={startCheckout}
              disabled={pending}
              className="mt-7 h-11 w-full rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
            >
              {pending ? "Sender dig videre…" : "Gå til betaling"}
            </button>

            <p className="mt-3 text-[13px] text-muted">
              Betaling håndteres sikkert af Stripe. Du kan opsige når som helst.
            </p>
          </div>
        )}

        {step === "bekraeft" && (
          <div className="rounded-sm border border-line bg-white p-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-orange/10 text-orange">
              <Mail className="size-6" strokeWidth={1.75} />
            </span>

            <h1 className="mt-5 font-display text-[26px] font-normal text-navy">
              Bekræft din e-mail
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-body">
              Din konto er oprettet. Vi har sendt dig en mail med et link — åbn
              det for at aktivere kontoen.
            </p>
            <p className="mx-auto mt-3 max-w-sm text-[14px] text-muted">
              Når du er bekræftet, logger du ind og gennemfører betalingen. Der
              er ikke trukket penge endnu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
