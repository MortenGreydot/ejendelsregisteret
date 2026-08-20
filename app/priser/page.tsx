import type { Metadata } from "next";

import { Navbar } from "../components/Navbar";
import { Faq } from "../components/priser/Faq";
import { PricingHero } from "../components/priser/PricingHero";

export const metadata: Metadata = {
  title: "Priser — Ejendelsregisteret",
  description:
    "Medlemskab til privat og erhverv. 25 ejendele inkluderet, ekstra ejendele 2 kr./stk./md.",
};

export default function Priser() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PricingHero />
        <Faq />
      </main>
    </>
  );
}
