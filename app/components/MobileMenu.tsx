"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SECTIONS, isActivePath } from "@/lib/nav";

import { AuthMenu } from "./AuthMenu";
import { NavSearch } from "./NavSearch";

/**
 * Navigationen på mobil.
 *
 * Skuffen glider ind fra højre. Bredden animeres ikke — det er `translate`,
 * så browseren kan flytte laget på GPU'en frem for at ombryde indholdet ved
 * hver frame.
 */
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Baggrunden må ikke kunne scrolles mens skuffen er åben. Dialoger klares
  // af en :has-regel i globals.css, men det her er ikke en <dialog>.
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Åbn menu"
        aria-expanded={open}
        className="text-white/85 transition-colors hover:text-white md:hidden"
      >
        <Menu className="size-6" strokeWidth={1.75} />
      </button>

      {/* Baggrundssløret. Sidder under skuffen og lukker ved klik. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[#3d3d3d]/70 transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Menu"
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 flex h-full w-[min(20rem,85vw)] flex-col bg-navy transition-transform duration-300 ease-out md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-4">
          <span className="text-[13px] font-semibold uppercase tracking-[0.18em] text-orange">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Luk menu"
            className="text-white/80 transition-colors hover:text-white"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="border-b border-white/15 px-5 py-4">
          <NavSearch alwaysOpen />
        </div>

        <nav className="flex flex-col px-2 py-3">
          {SECTIONS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-3 py-3 text-[16px] transition-colors ${
                  active
                    ? "bg-white/10 font-semibold text-orange"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-white/15 px-5 py-5">
          <AuthMenu initialSignedIn={signedIn} />
        </div>
      </aside>
    </>
  );
}
