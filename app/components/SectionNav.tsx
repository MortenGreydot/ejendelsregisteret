"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECTIONS, isActivePath } from "@/lib/nav";

export function SectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-11 items-center gap-8 text-[15px] ml-2">
      {SECTIONS.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-orange pb-0.5 text-black"
                : "pb-0.5 text-black/70 transition-colors hover:text-black"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
