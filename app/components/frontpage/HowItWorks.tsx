import { ArrowRight, FileText, Share2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Step = {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  link: string;
};

const steps: Step[] = [
  {
    icon: FileText,
    label: "Registrér",
    title: "Registrér dine ejendele",
    body: "Tilføj serienummer, billeder og kvittering for dine ejendele. Det tager kun få minutter.",
    link: "Læs mere",
  },
  {
    icon: ShieldCheck,
    label: "Beskyt",
    title: "Beskyt automatisk",
    body: "Alle data krypteres og gemmes sikkert. Du kontrollerer hvem der ser hvad.",
    link: "Forsikring & dokumentation",
  },
  {
    icon: Share2,
    label: "Del",
    title: "Del med de rigtige",
    body: "Send til forsikring, politiet eller forhandleren med ét klik — dele vil du.",
    link: "Om notifikationer",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center font-display text-[30px] font-normal uppercase tracking-[0.14em] text-navy">
          Sådan virker det
        </h2>

        <div className="mt-16 grid gap-12 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full border border-line text-navy">
                <step.icon className="size-5" strokeWidth={1.5} />
              </span>
              <p className="mt-4 text-[9px] font-medium uppercase tracking-[0.2em] text-muted">
                {step.label}
              </p>
              <h3 className="mt-3 font-display text-[19px] font-normal text-navy">
                {step.title}
              </h3>
              <p className="mx-auto mt-3 max-w-[17rem] text-[12.5px] leading-[1.75] text-body">
                {step.body}
              </p>
              <a
                href="#"
                className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium text-orange transition-colors hover:text-orange-dark"
              >
                {step.link}
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <a
            href="#"
            className="inline-flex h-11 items-center rounded-sm border border-line px-6 text-[14px] font-medium text-navy transition-colors hover:border-navy"
          >
            Læs den fulde guide
          </a>
        </div>
      </div>
    </section>
  );
}
