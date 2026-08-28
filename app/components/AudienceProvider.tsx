"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { AUDIENCE_COOKIE, type Audience } from "@/lib/audience-shared";

export type { Audience };

type AudienceContextValue = {
  audience: Audience;
  setAudience: (audience: Audience) => void;
  isPrivat: boolean;
  isErhverv: boolean;
};

const AudienceContext = createContext<AudienceContextValue | null>(null);

/**
 * Valget mellem privat og erhverv.
 *
 * Gemmes i en cookie frem for localStorage, fordi serveren skal kunne læse
 * det. Forsiden har helt forskelligt indhold for de to, og med localStorage
 * ville serveren altid rendere privat-udgaven — en erhvervsbesøgende ville
 * se den forkerte forside blinke forbi inden hydreringen nåede at rette den.
 *
 * `initial` kommer fra layout'et, som læser cookien server-side. Dermed er
 * server og klient enige fra første render, og der er ingen hydreringsfejl.
 */
export function AudienceProvider({
  initial,
  children,
}: {
  initial: Audience;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [audience, setAudienceState] = useState<Audience>(initial);

  const setAudience = useCallback(
    (next: Audience) => {
      setAudienceState(next);

      // Et år, så valget huskes. Lax er nok: cookien styrer kun hvilket
      // indhold der vises, den giver ingen adgang til noget.
      document.cookie = `${AUDIENCE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;

      // Server-komponenterne har allerede renderet med den gamle værdi.
      // Uden refresh ville kun de klientkomponenter der bruger hook'en
      // skifte, mens siden omkring dem blev stående.
      router.refresh();
    },
    [router],
  );

  const value = useMemo<AudienceContextValue>(
    () => ({
      audience,
      setAudience,
      isPrivat: audience === "privat",
      isErhverv: audience === "erhverv",
    }),
    [audience, setAudience],
  );

  return (
    <AudienceContext.Provider value={value}>
      {children}
    </AudienceContext.Provider>
  );
}

export function useAudience() {
  const context = useContext(AudienceContext);

  if (!context) {
    throw new Error("useAudience skal bruges inde i en <AudienceProvider>");
  }

  return context;
}
