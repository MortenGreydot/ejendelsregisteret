"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * Lille ⓘ i øverste højre hjørne af det element den hører til.
 * Forælderen skal være `relative`.
 *
 * Åbner på hover. Tastaturbrugere får den på fokus, og et klik slår den til
 * og fra — uden det ville forklaringen være utilgængelig på touch, hvor
 * hover ikke findes.
 */
export function InfoHint({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    // Kun relevant for touch, hvor der ikke kommer noget mouseleave.
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="absolute -top-1.5 -right-1.5 inline-flex"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`Om ${title}`}
        className="text-muted transition-colors hover:text-navy"
      >
        <Info className="size-3" strokeWidth={2.25} />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute right-0 bottom-full z-20 mb-2 w-[min(16rem,calc(100vw-2rem))] rounded-sm border border-line bg-white p-3 text-left shadow-lg shadow-navy/10 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <span className="block text-[13px] font-bold text-navy">{title}</span>
          <span className="mt-1 block text-[13px] leading-relaxed text-body">
            {children}
          </span>
        </span>
      )}
    </span>
  );
}
