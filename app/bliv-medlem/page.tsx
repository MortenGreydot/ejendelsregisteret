import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { SignupFlow } from "../components/medlem/SignupFlow";

export const metadata: Metadata = {
  title: "Bliv medlem — Ejendelsregisteret",
  description:
    "Opret dit medlemskab: vælg abonnement, opret konto og gennemfør betalingen.",
};

export default async function BlivMedlem() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Er man allerede logget ind, springes kontotrinnet over.
  const signedIn = Boolean(data?.claims);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="px-6 py-16">
          <SignupFlow signedIn={signedIn} />
        </div>
      </main>
    </>
  );
}
