import { getAudience } from "@/lib/audience";
import { PLANS } from "@/lib/plans";

import { Navbar } from "./components/Navbar";
import { BusinessHero } from "./components/frontpage/BusinessHero";
import { Hero } from "./components/frontpage/Hero";
import { HowItWorks } from "./components/frontpage/HowItWorks";
import { LostSomething } from "./components/frontpage/LostSomething";
import { ProtectBanner } from "./components/frontpage/ProtectBanner";
import { SerialSection } from "./components/frontpage/SerialSection";

export default async function Home() {
  // Læses fra cookien server-side, så den rigtige forside renderes med det
  // samme. Lå valget kun i klienten, ville en erhvervsbesøgende se
  // privat-forsiden blinke forbi inden hydreringen nåede at rette den.
  const audience = await getAudience();
  const isErhverv = audience === "erhverv";
  const plan = PLANS[audience];

  return (
    <>
      <Navbar />
      <main>
        {isErhverv ? <BusinessHero /> : <Hero plan={plan} />}
        <SerialSection />
        <ProtectBanner />
        <HowItWorks />
        <LostSomething />
      </main>
    </>
  );
}
