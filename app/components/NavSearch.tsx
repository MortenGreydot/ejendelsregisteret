"use client";

import { Search, X } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Søgefeltet i navbaren.
 *
 * Foldes ud fra højre mod venstre på hover: det hvide felt vokser ud bag
 * forstørrelsesglasset, som bliver siddende i højre kant. Ikonet flytter sig
 * altså ikke — kun feltet vokser — så resten af bjælken står stille.
 *
 * Åbner også på fokus og på klik. Hover findes ikke på touch, og et felt der
 * kun kan nås med mus ville være usynligt på telefon.
 */
export function NavSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Tom søgning skal ikke sende nogen til resultatsiden.
    if (!value.trim()) {
      event.preventDefault();
      inputRef.current?.focus();
    }
  }

  function handleTrigger(event: React.MouseEvent) {
    // Er feltet tomt, er klikket ment som "åbn", ikke som "søg".
    if (!value.trim()) {
      event.preventDefault();
      inputRef.current?.focus();
    }
  }

  return (
    <form
      action="/serienummer"
      onSubmit={handleSubmit}
      role="search"
      className="group flex"
    >
      <label htmlFor="nav-soeg" className="sr-only">
        Søg på serienummer
      </label>

      {/* Baggrunden toner ind sammen med bredden, så feltet ikke blot
          dukker op som en hvid firkant. */}
      <div className="flex h-9 items-center rounded-sm bg-white/0 transition-colors duration-300 group-hover:bg-white group-focus-within:bg-white">
        <input
          ref={inputRef}
          id="nav-soeg"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Søg på serienummer"
          className="h-full w-0 bg-transparent pl-0 text-[15px] text-navy opacity-0 transition-all duration-300 ease-out placeholder:text-muted focus:outline-none group-hover:w-56 group-hover:pl-3.5 group-hover:opacity-100 group-focus-within:w-56 group-focus-within:pl-3.5 group-focus-within:opacity-100 [&::-webkit-search-cancel-button]:hidden"
        />

        {value && (
          <button
            type="button"
            aria-label="Ryd søgning"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="px-1 text-muted transition-colors hover:text-navy"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        )}

        <button
          type="submit"
          onClick={handleTrigger}
          aria-label="Søg"
          className="px-2.5 text-white/80 transition-colors duration-300 group-hover:text-navy group-hover:hover:text-orange group-focus-within:text-navy"
        >
          <Search className="size-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </form>
  );
}
