"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type Category = { id: number; name: string };

/**
 * Kategorifelt: fritekst med forslag.
 *
 * Findes kategorien ikke, oprettes den ved indsendelse. Normaliseringen —
 * trim, sammenklappede mellemrum, versalufølsom sammenligning, længdegrænse —
 * sker i databasefunktionen get_or_create_category, ikke her. Klientvalidering
 * kan omgås, og to brugere kan ramme samme nye navn samtidig.
 */
export function CategoryCombobox({
  categories,
  value,
  onChange,
  disabled,
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();

  const matches = useMemo(
    () =>
      query === ""
        ? categories
        : categories.filter((c) => c.name.toLowerCase().includes(query)),
    [categories, query],
  );

  const exactMatch = categories.some((c) => c.name.toLowerCase() === query);
  const canCreate = query !== "" && !exactMatch;
  const optionCount = matches.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Listen kan skrumpe mens man skriver, så indekset klampes under render
  // i stedet for at blive nulstillet i en effect (som lint med rette
  // afviser — det ville give en ekstra render pr. tastetryk).
  const activeIndex = optionCount === 0 ? 0 : Math.min(active, optionCount - 1);

  function choose(index: number) {
    if (index < matches.length) onChange(matches[index].name);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        const from = optionCount === 0 ? 0 : Math.min(i, optionCount - 1);
        return (from + step + optionCount) % Math.max(optionCount, 1);
      });
      return;
    }
    if (event.key === "Enter" && open && optionCount > 0) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id="ny-kategori"
        role="combobox"
        aria-expanded={open}
        aria-controls="kategori-liste"
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder="Vælg eller skriv en kategori"
        className="mt-2 h-11 w-full rounded-sm border border-line bg-white pr-10 pl-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60"
      />

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="absolute top-1/2 right-3 mt-1 -translate-y-1/2 text-muted"
      >
        <ChevronDown className="size-4" strokeWidth={2} />
      </button>

      {open && optionCount > 0 && (
        <ul
          id="kategori-liste"
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-line bg-white py-1 shadow-lg shadow-navy/10"
        >
          {matches.map((category, index) => (
            <li key={category.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-[15px] ${
                  index === activeIndex ? "bg-mist text-navy" : "text-body"
                }`}
              >
                {category.name.toLowerCase() === query && (
                  <Check className="size-3.5 text-orange" strokeWidth={2.5} />
                )}
                {category.name}
              </button>
            </li>
          ))}

          {canCreate && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === matches.length}
                onMouseEnter={() => setActive(matches.length)}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-2 border-t border-line px-3.5 py-2 text-left text-[15px] ${
                  activeIndex === matches.length ? "bg-mist" : ""
                }`}
              >
                <Plus className="size-3.5 text-orange" strokeWidth={2.5} />
                <span className="text-body">
                  Opret{" "}
                  <strong className="font-semibold text-navy">
                    {value.trim()}
                  </strong>
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
