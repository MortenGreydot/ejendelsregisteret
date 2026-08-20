import { Navbar } from "./components/Navbar";
import { Hero } from "./components/frontpage/Hero";
import { HowItWorks } from "./components/frontpage/HowItWorks";
import { LostSomething } from "./components/frontpage/LostSomething";
import { ProtectBanner } from "./components/frontpage/ProtectBanner";
import { SerialSection } from "./components/frontpage/SerialSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SerialSection />
        <ProtectBanner />
        <HowItWorks />
        <LostSomething />
      </main>
    </>
  );
}
