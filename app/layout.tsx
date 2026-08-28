import type { Metadata } from "next";
import { Abhaya_Libre } from "next/font/google";
import "./globals.css";

import { getAudience } from "@/lib/audience";

import { AudienceProvider } from "./components/AudienceProvider";

const abhaya = Abhaya_Libre({
  variable: "--font-abhaya",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ejendelsregisteret — Danmarks digitale tingbog for værdigenstande",
  description:
    "Registrér serienummer, kvittering og billeder på dine ejendele — så har du dokumentationen klar den dag du får brug for den.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const audience = await getAudience();

  return (
    <html
      lang="da"
      className={`${abhaya.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AudienceProvider initial={audience}>{children}</AudienceProvider>
      </body>
    </html>
  );
}
