import { withSupabase } from "npm:@supabase/server";

import { getStripe } from "../_shared/config.ts";

/**
 * Sletter brugerens konto og alt hvad der hører til.
 *
 * Rækkefølgen er valgt efter hvad der gør mindst skade hvis et trin fejler:
 *
 *   1. Opsig abonnementet i Stripe. Sker det ikke, bliver brugeren ved med
 *      at blive opkrævet for en konto der ikke findes. Derfor først.
 *   2. Hent filstierne, mens rækkerne stadig findes.
 *   3. Slet filerne. Fejler det, afbrydes hele operationen — kontoen består,
 *      og brugeren kan prøve igen. Alternativet var forældreløse filer i et
 *      lager ingen længere kan tilgå.
 *   4. Slet auth-brugeren. Alle tabeller har ON DELETE CASCADE mod
 *      auth.users, så profil, abonnement, ejendele, serienumre, billed- og
 *      dokumentrækker, forbrug og betalinger forsvinder i ét hug.
 */
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "Ikke logget ind" }, { status: 401 });
    }

    const admin = ctx.supabaseAdmin;

    try {
      // 1. Stop opkrævningen
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (sub?.stripe_subscription_id) {
        try {
          await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
        } catch (error) {
          // Er abonnementet allerede opsagt, er målet nået. Andre fejl skal
          // stoppe sletningen, så vi ikke efterlader en aktiv opkrævning.
          const message = error instanceof Error ? error.message : "";
          if (!message.includes("No such subscription")) {
            return Response.json(
              { error: `Kunne ikke opsige abonnementet: ${message}` },
              { status: 500 },
            );
          }
        }
      }

      // 2. Find filerne
      const { data: items } = await admin
        .from("items")
        .select("item_images(file_path), item_documents(file_path)")
        .eq("user_id", userId);

      const rows = (items ?? []) as unknown as {
        item_images: { file_path: string }[] | null;
        item_documents: { file_path: string }[] | null;
      }[];

      const imagePaths = rows.flatMap((r) =>
        (r.item_images ?? []).map((f) => f.file_path),
      );
      const documentPaths = rows.flatMap((r) =>
        (r.item_documents ?? []).map((f) => f.file_path),
      );

      // 3. Slet filerne
      if (imagePaths.length > 0) {
        const { error } = await admin.storage
          .from("item-images")
          .remove(imagePaths);
        if (error) {
          return Response.json(
            { error: `Kunne ikke slette billeder: ${error.message}` },
            { status: 500 },
          );
        }
      }

      if (documentPaths.length > 0) {
        const { error } = await admin.storage
          .from("item-documents")
          .remove(documentPaths);
        if (error) {
          return Response.json(
            { error: `Kunne ikke slette kvitteringer: ${error.message}` },
            { status: 500 },
          );
        }
      }

      // 4. Slet brugeren — resten følger med via cascade
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return Response.json({ error: deleteError.message }, { status: 500 });
      }

      return Response.json({
        deleted: true,
        images: imagePaths.length,
        documents: documentPaths.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("delete-account:", message);
      return Response.json({ error: message }, { status: 500 });
    }
  }),
};
