import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { Faq } from "../components/priser/Faq";
import { PricingHero } from "../components/priser/PricingHero";

export const metadata: Metadata = {
  title: "Priser — Ejendelsregisteret",
  description:
    "Medlemskab til privat og erhverv. 5 ejendele inkluderet, ekstra ejendele 2 kr./stk./md.",
};

export default async function Priser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Har man allerede et aktivt medlemskab, giver "Kom i gang" ingen mening —
  // create-checkout ville alligevel afvise med 409. Bedre at sige det på
  // knappen end at lade brugeren opdage det efter et klik.
  let hasSubscription = false;
  if (data?.claims?.sub) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", data.claims.sub)
      .maybeSingle();
    hasSubscription = sub?.status === "active";
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PricingHero hasSubscription={hasSubscription} />
        <Faq />
      </main>
    </>
  );
}
