import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session-fornyelse på hver request.
 *
 * Dette er Next.js' middleware — ikke en Supabase edge function. Filen hed
 * `middleware.ts` indtil Next 16, hvor konventionen blev omdøbt til `proxy.ts`
 * med `export function proxy`. Funktionaliteten er den samme. Supabases
 * dokumentation viser stadig det gamle navn.
 *
 * Hvorfor er den nødvendig?
 * Supabase-tokens udløber (typisk efter en time) og skal fornyes med et
 * refresh token. Fornyelsen kræver at der kan SKRIVES cookies — og det må
 * Server Components ikke. Uden dette lag ville en bruger med et udløbet token
 * fremstå som logget ud, indtil de ramte en Route Handler.
 *
 * Proxy kører før enhver route renderes og har fuld adgang til både request
 * og response, så her kan cookies skrives. Rækkefølgen er:
 *
 *   1. Browseren sender sine cookies med requesten
 *   2. Proxy læser dem, beder Supabase validere/forny tokenet
 *   3. Er tokenet fornyet, skrives de nye cookies på svaret
 *   4. Siden renderes med en gyldig session
 */
export async function proxy(request: NextRequest) {
  // Svaret oprettes FØR Supabase-klienten, fordi setAll skal kunne skrive på
  // netop dette objekt. Byttes rækkefølgen om, tabes de fornyede cookies.
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        /** Cookies ind: brugerens nuværende session. */
        getAll() {
          return request.cookies.getAll();
        },
        /** Cookies ud: den fornyede session, sat på svaret til browseren. */
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() validerer JWT'ets signatur og fornyer tokenet hvis det er
  // udløbet. Returværdien bruges ikke her — det er bivirkningen (de fornyede
  // cookies via setAll ovenfor) der er hele pointen.
  //
  // getClaims() frem for getSession(): getSession() læser bare cookien og
  // stoler på den, mens getClaims() verificerer signaturen. Til beskyttelse
  // af sider skal det være getClaims() (eller getUser()).
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  /**
   * Hvilke stier proxy'en kører på.
   *
   * Negativt lookahead: alt UNDTAGEN Next.js' statiske filer og billeder.
   * De behøver ingen session, og at køre et netværkskald mod Supabase for
   * hvert ikon ville koste latency på hver eneste asset.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
