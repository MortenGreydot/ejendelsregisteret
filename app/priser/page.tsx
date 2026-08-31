import type { Metadata } from "next";

import type { SubscriptionStatus } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { Faq } from "../components/priser/Faq";
import { PricingHero } from "../components/priser/PricingHero";

export const metadata: Metadata = {
  title: "Priser — Ejendelsregisteret",
  description:
    "Medlemskab til privat og erhverv. 5 ejendele inkluderet, ekstra ejendele 2 kr./stk./md.",
};

/** Priser */
export default async function PricingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Har man allerede et aktivt medlemskab, giver "Kom i gang" ingen mening —
  // create-checkout ville alligevel afvise med 409. Bedre at sige det på
  // knappen end at lade brugeren opdage det efter et klik.
  const signedIn = Boolean(data?.claims?.sub);

  let status: SubscriptionStatus = null;
  if (data?.claims?.sub) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", data.claims.sub)
      .maybeSingle();
    status = (sub?.status ?? null) as SubscriptionStatus;
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <PricingHero signedIn={signedIn} status={status} />
        <Faq />
      </main>
    </>
  );
}
