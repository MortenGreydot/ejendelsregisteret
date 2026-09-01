import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { SignupFlow } from "../components/medlem/SignupFlow";

export const metadata: Metadata = {
  title: "Bliv medlem | Ejendelsregisteret",
  description:
    "Opret dit medlemskab: vælg abonnement, opret konto og gennemfør betalingen.",
};

/** Bliv medlem */
export default async function BecomeMemberPage({
  searchParams,
}: PageProps<"/bliv-medlem">) {
  const params = await searchParams;
  // Kommer man fra prissiden, er medlemskabet allerede valgt der.
  const skipPlanStep = params.trin === "konto";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Er man allerede logget ind, springes kontotrinnet over.
  const signedIn = Boolean(data?.claims);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="px-6 py-16">
          <SignupFlow signedIn={signedIn} skipPlanStep={skipPlanStep} />
        </div>
      </main>
    </>
  );
}
