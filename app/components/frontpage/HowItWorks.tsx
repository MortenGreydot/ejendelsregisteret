import { ArrowRight } from "lucide-react";

const steps = [
  {
    title: "Registrér",
    body: "Serienummer, billeder og kvittering. Det tager to minutter pr. ting.",
  },
  {
    title: "Kun din liste",
    body: "Ingen andre kan se hvad du ejer. Slår nogen et helt serienummer op, ser de genstanden — aldrig hvem der ejer den.",
  },
  {
    title: "Send videre",
    body: "Dokumentationen ryger til forsikring, politi eller forhandler med ét klik.",
  },
];

export function HowItWorks() {
  return (
    <section id="saadan-virker-det" className="scroll-mt-8 bg-white">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-[26px] font-normal text-navy">
            Sådan virker det
          </h2>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium text-orange transition-colors hover:text-orange-dark"
          >
            Læs den fulde guide
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </a>
        </div>

        <ol className="mt-8 grid gap-px overflow-hidden rounded-sm bg-line sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="bg-white px-6 py-6">
              <span className="font-display text-[15px] font-bold text-orange">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-[19px] font-normal text-navy">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[14.5px] leading-[1.7] text-body">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
