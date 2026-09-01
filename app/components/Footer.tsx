import Image from "next/image";
import Link from "next/link";

import { COMPANY, FOOTER_NAV, LEGAL_PAGES } from "@/lib/legal";

const linkClass =
  "text-[15px] text-white/65 transition-colors hover:text-white";

const headingClass =
  "text-[13px] font-semibold uppercase tracking-[0.16em] text-white";

/**
 * Footeren.
 *
 * Bevidst kort. En footer er ikke et sitemap — den skal svare på "hvor kom
 * jeg fra" og "hvem står bag", og så være færdig. To kolonner rækker:
 * navigation til dem der leder videre, og juridisk til dem der leder efter
 * betingelser eller vil vide hvad vi gemmer.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-navy text-white ">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/images/logo-ejendel.png"
                alt=""
                width={60}
                height={96}
                className=" shrink-0"
              />
              <span className="font-display text-[22px] font-bold tracking-tight">
                {COMPANY.service}
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-white/60">
              Danmarks digitale register til dokumentation af personlige
              ejendele. Serienummer, kvittering og billeder samlet ét sted.
            </p>
          </div>

          <nav aria-labelledby="footer-nav">
            <p id="footer-nav" className={headingClass}>
              Navigation
            </p>
            <ul className="mt-4 space-y-2.5">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal">
            <p id="footer-legal" className={headingClass}>
              Juridisk
            </p>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_PAGES.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[14px] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {COMPANY.service} &middot; {COMPANY.legalName}{" "}
            &middot; CVR {COMPANY.cvr}
          </p>
          <a
            href={`mailto:${COMPANY.email}`}
            className="transition-colors hover:text-white"
          >
            {COMPANY.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
