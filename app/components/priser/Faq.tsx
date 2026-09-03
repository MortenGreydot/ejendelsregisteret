"use client";

import { PLANS, faq } from "@/lib/plans";

import { useAudience } from "../AudienceProvider";

/**
 * Spørgsmålene følger den viste plan.
 *
 * Klientkomponent af samme grund som PricingHero ovenfor på siden: skifter
 * man mellem Privat og Erhverv, skal svarene skifte med. Ellers kunne en
 * erhvervsbesøgende læse et svar med privatprisen i.
 */
export function Faq() {
  const { audience } = useAudience();
  const items = faq(PLANS[audience]);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="text-center font-display text-[24px] font-normal text-navy">
          Ofte stillede spørgsmål
        </h2>

        <dl className="mt-10">
          {items.map((item, index) => (
            <div
              key={item.question}
              className={index > 0 ? "border-t border-line pt-6" : ""}
            >
              <dt className="text-[15px] font-bold text-navy">
                {item.question}
              </dt>
              <dd className="mt-2 pb-6 text-[14.5px] leading-[1.7] text-body">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
