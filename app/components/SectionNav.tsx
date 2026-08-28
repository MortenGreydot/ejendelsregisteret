"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { label: "Forside", href: "/" },
  { label: "Kontakt", href: "/kontakt" },
  { label: "Serienummer", href: "/serienummer" },
  { label: "Priser", href: "/priser" },
] as const;

export function SectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-11 items-center gap-8 text-[15px]">
      {sections.map((item) => {
        // Forsiden matcher kun eksakt, ellers ville den være aktiv overalt.
        // De øvrige matcher også undersider: /kontakt/noget markerer Kontakt,
        // men /kontakter gør ikke — derfor skråstregen i startsWith.
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-orange pb-0.5 text-white"
                : "pb-0.5 text-white/70 transition-colors hover:text-white"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
