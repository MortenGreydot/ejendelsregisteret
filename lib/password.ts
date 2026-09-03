/**
 * Kravene til en adgangskode. Ét sted.
 *
 * Reglerne bruges tre steder — oprettelse i login-dialogen, oprettelse i
 * medlemsflowet og nulstilling — og skal være ens alle tre. Stod de i hver
 * sin komponent, ville en bruger kunne vælge en kode ét sted som blev
 * afvist et andet.
 *
 * Bemærk at det her er hjælp til brugeren, ikke sikkerhed. Kontrollen sker
 * i browseren og kan omgås. Den rigtige håndhævelse er Supabases egne
 * indstillinger under Authentication → Providers → Email, hvor både
 * minimumslængde og tegnkrav kan sættes. Teksterne her skal matche dem.
 */

/** Mindste længde. Skal matche minimum_password_length i Supabase. */
export const PASSWORD_MIN = 8;

/**
 * Hjælpeteksten under feltet.
 *
 * Kravene står FØR man skriver, ikke som en fejl bagefter. En bruger der
 * får afvist sin kode tre gange i træk, gætter — en bruger der kan læse
 * kravet, vælger rigtigt første gang.
 */
export const PASSWORD_HINT =
  `Mindst ${PASSWORD_MIN} tegn og mindst ét stort bogstav. Et tal gør den stærkere.`;

/**
 * Første fejl i klartekst, eller null hvis koden er i orden.
 *
 * Tallet er bevidst ikke et krav, kun en anbefaling. Hvert ekstra krav
 * flytter folk mod "Sommer2026!" — en kode der opfylder alting og alligevel
 * er blandt de første en maskine prøver. Længde er det der tæller, og
 * derfor er det den regel der står først.
 *
 * Æ, Ø og Å tæller som store bogstaver. Det er danske brugere, og en kode
 * der begynder med Ærlig skal ikke afvises.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Adgangskoden skal være mindst ${PASSWORD_MIN} tegn. Flere ord i træk er både nemmere at huske og sværere at gætte.`;
  }

  if (!/[A-ZÆØÅ]/.test(password)) {
    return "Adgangskoden skal indeholde mindst ét stort bogstav.";
  }

  return null;
}

/** Om koden også har et tal. Bruges til hjælpeteksten, ikke til at afvise. */
export const hasDigit = (password: string) => /\d/.test(password);

/** Fejlen når de to felter ikke er ens. */
export const PASSWORD_MISMATCH = "De to adgangskoder er ikke ens.";
export const EMAIL_MISMATCH = "De to mailadresser er ikke ens.";

/**
 * Sammenligner to mailadresser.
 *
 * Store og små bogstaver ignoreres: skriver man sin adresse med stort i det
 * ene felt og småt i det andet, er det den samme adresse — og at afvise det
 * ville være at drille brugeren med noget der ikke er en fejl.
 */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
