import type { Metadata } from "next";

import { ContactForm } from "../components/ContactForm";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Kontakt — Ejendelsregisteret",
  description: "Skriv til os. Vi svarer typisk inden for en hverdag.",
};

export default function Kontakt() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-mist">
        <div className="mx-auto max-w-lg px-6 py-20">
          <h1 className="text-center font-display text-[36px] font-normal text-navy">
            Kontakt
          </h1>
          <p className="mt-2 text-center text-[15px] text-body">
            Vi svarer hurtigt &mdash; typisk inden for en hverdag.
          </p>

          <div className="mt-10">
            <ContactForm />
          </div>
        </div>
      </main>
    </>
  );
}
