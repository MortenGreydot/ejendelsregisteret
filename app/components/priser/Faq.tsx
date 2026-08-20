import { FAQ } from "@/lib/plans";

export function Faq() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="text-center font-display text-[22px] font-normal text-navy">
          Ofte stillede spørgsmål
        </h2>

        <dl className="mt-10">
          {FAQ.map((item, index) => (
            <div
              key={item.question}
              className={index > 0 ? "border-t border-line pt-6" : ""}
            >
              <dt className="text-[13px] font-bold text-navy">
                {item.question}
              </dt>
              <dd className="mt-2 pb-6 text-[12.5px] leading-[1.7] text-body">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
