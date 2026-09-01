import type { Metadata } from "next";

import { ResetPasswordForm } from "../components/auth/ResetPasswordForm";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Vælg ny adgangskode | Ejendelsregisteret",
  description: "Vælg en ny adgangskode til din konto.",
  robots: { index: false, follow: false },
};

/** Vælg ny adgangskode */
export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="font-display text-[30px] leading-tight font-normal text-navy">
            Vælg ny adgangskode
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-body">
            Den nye kode gælder med det samme, og du bliver logget ind.
          </p>

          <div className="mt-8">
            <ResetPasswordForm />
          </div>
        </div>
      </main>
    </>
  );
}
