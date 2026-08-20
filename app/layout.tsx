import type { Metadata } from "next";
import { Abhaya_Libre, Inter, Lora } from "next/font/google";
import "./globals.css";

import { AudienceProvider } from "./components/AudienceProvider";

const abhaya = Abhaya_Libre({
  variable: "--font-abhaya",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const lora = Lora({
  variable: "--font-lora",
  style: ["italic"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ejendelsregisteret — Danmarks digitale tingbog for værdigenstande",
  description:
    "Registrér serienummer, kvittering og billeder på dine ejendele — så har du dokumentationen klar den dag du får brug for den.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="da"
      className={`${abhaya.variable} ${lora.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AudienceProvider>{children}</AudienceProvider>
      </body>
    </html>
  );
}
