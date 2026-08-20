import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { Navbar } from "../components/Navbar";
import { SignOutButton } from "../components/SignOutButton";

export const metadata: Metadata = {
  title: "Min side — Ejendelsregisteret",
};

export default async function MinSide() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/");
  }

  const { email, sub } = data.claims;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-6 py-20">
        <h1 className="font-display text-[34px] font-normal text-navy">
          Min side
        </h1>
        <p className="mt-3 text-[14px] text-body">
          Du er logget ind som{" "}
          <strong className="font-semibold text-navy">{email}</strong>.
        </p>

        <dl className="mt-10 max-w-md space-y-4 border-t border-line pt-6 text-[13px]">
          <div className="flex justify-between gap-6">
            <dt className="text-muted">Bruger-id</dt>
            <dd className="font-mono text-navy">{sub}</dd>
          </div>
        </dl>

        <div className="mt-10">
          <SignOutButton />
        </div>
      </main>
    </>
  );
}
