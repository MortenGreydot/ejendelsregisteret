import { createClient } from "@/lib/supabase/client";

/**
 * Kalder en edge function og oversætter fejl til noget en bruger kan læse.
 *
 * `functions.invoke` er ubehagelig at bruge direkte af tre grunde:
 *
 *   1. Ved non-2xx kaster den, og beskeden er altid den samme intetsigende
 *      "Edge Function returned a non-2xx status code". Selve svaret ligger
 *      gemt i `error.context`.
 *   2. Netværksfejl kaster helt ud af kaldet. Uden try/catch bliver en
 *      afvist promise til tavshed — knappen står deaktiveret, og brugeren
 *      ser intet ske.
 *   3. 401 betyder "ikke logget ind" og fortjener sin egen besked frem for
 *      en teknisk kode.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke<T>(name, { body });

    if (!error) return { data, error: null };

    const response = (error as { context?: Response }).context;

    if (response?.status === 401) {
      return { data: null, error: "Du skal være logget ind." };
    }

    if (response && typeof response.json === "function") {
      try {
        const parsed = await response.json();
        if (parsed?.error) return { data: null, error: parsed.error };
      } catch {
        // Svaret var ikke JSON — fald tilbage på beskeden nedenfor.
      }
    }

    return { data: null, error: error.message };
  } catch (caught) {
    // Hertil når vi ved netværksfejl og ved kast inde i klienten. Uden
    // dette ville kaldet fejle uden at nogen opdagede det.
    return {
      data: null,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
