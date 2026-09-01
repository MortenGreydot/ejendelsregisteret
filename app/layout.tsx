import type { Metadata } from "next";
import { Abhaya_Libre } from "next/font/google";
import "./globals.css";

import { getAudience } from "@/lib/audience";
import { SITE_URL } from "@/lib/site";

import { AudienceProvider } from "./components/AudienceProvider";
import { Footer } from "./components/Footer";
import { StructuredData } from "./components/StructuredData";

const abhaya = Abhaya_Libre({
  variable: "--font-abhaya",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  /**
   * Uden metadataBase bliver Open Graph-billeder og canonical-links til
   * relative stier. Ingen social platform kan hente dem, og Google kan
   * ikke afgøre hvilken adresse der er den rigtige.
   */
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "Ejendelsregisteret | Danmarks digitale tingbog for værdigenstande",
  description:
    "Registrér serienummer, kvittering og billeder på dine ejendele, så har du dokumentationen klar den dag du får brug for den.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const audience = await getAudience();

  return (
    <html
      lang="da"
      className={`${abhaya.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StructuredData />
        <AudienceProvider initial={audience}>
          {children}
          <Footer />
        </AudienceProvider>
      </body>
    </html>
  );
}
