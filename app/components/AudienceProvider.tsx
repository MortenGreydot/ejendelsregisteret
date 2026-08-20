"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Audience = "privat" | "erhverv";

const STORAGE_KEY = "ejendelsregisteret:audience";
const DEFAULT_AUDIENCE: Audience = "privat";

function isAudience(value: unknown): value is Audience {
  return value === "privat" || value === "erhverv";
}

/**
 * Lille store uden for React, så valget kan læses fra localStorage uden
 * setState i en effect. useSyncExternalStore bruger getServerSnapshot under
 * SSR og hydrering og skifter først til den gemte værdi bagefter — derfor
 * opstår der ingen hydreringsfejl.
 */
const listeners = new Set<() => void>();
let cached: Audience | null = null;

function getSnapshot(): Audience {
  if (cached === null) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cached = isAudience(stored) ? stored : DEFAULT_AUDIENCE;
  }
  return cached;
}

function getServerSnapshot(): Audience {
  return DEFAULT_AUDIENCE;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  // Holder faner i sync: storage-eventet fyrer kun i de andre faner.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = null;
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeAudience(next: Audience) {
  cached = next;
  window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

type AudienceContextValue = {
  audience: Audience;
  setAudience: (audience: Audience) => void;
  isPrivat: boolean;
  isErhverv: boolean;
};

const AudienceContext = createContext<AudienceContextValue | null>(null);

export function AudienceProvider({ children }: { children: React.ReactNode }) {
  const audience = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setAudience = useCallback((next: Audience) => {
    writeAudience(next);
  }, []);

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
