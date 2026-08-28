/**
 * Delte værdier for audience-valget.
 *
 * Ligger bevidst i sit eget modul uden "use client". AudienceProvider er en
 * klientkomponent, og en server-fil kan ikke kalde en funktion importeret
 * derfra — grænsen kan kun krydses med komponenter og props. Både provideren
 * og server-hjælperen importerer herfra i stedet.
 */

export type Audience = "privat" | "erhverv";

export const AUDIENCE_COOKIE = "audience";
export const DEFAULT_AUDIENCE: Audience = "privat";

export function isAudience(value: unknown): value is Audience {
  return value === "privat" || value === "erhverv";
}
