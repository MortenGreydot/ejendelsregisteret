import type { Metadata } from "next";

import { ForgotPasswordForm } from "../components/auth/ForgotPasswordForm";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Glemt adgangskode | Ejendelsregisteret",
  description: "Få tilsendt et link til at vælge en ny adgangskode.",
  // Ingen grund til at siden ligger i søgeresultaterne. Den har intet
  // indhold at finde, og folk skal komme hertil fra login, ikke fra Google.
  robots: { index: false, follow: true },
};

/** Glemt adgangskode */
export default function ForgotPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="font-display text-[30px] leading-tight font-normal text-navy">
            Glemt adgangskode
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-body">
            Skriv den mail du oprettede kontoen med, så sender vi et link til
            at vælge en ny adgangskode.
          </p>

          <div className="mt-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </main>
    </>
  );
}
