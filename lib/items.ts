import { createClient } from "@/lib/supabase/client";
import { userMessage } from "@/lib/errors";

export type NewItem = {
  name: string;
  brand?: string;
  description?: string;
  /** Fritekst. Databasen normaliserer og opretter kategorien hvis den er ny. */
  categoryName?: string;
  serials: string[];
  images: File[];
  documents: File[];
};

/** Storage-nøgler må ikke indeholde vilkårlige tegn fra filnavnet. */
function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Opretter en ejendel med serienumre, billeder og kvitteringer.
 *
 * Ligger her frem for i en komponent, fordi både den almindelige dialog og
 * den trinvise guide skal bruge præcis samme forløb. Lå den to steder, ville
 * en rettelse — fx en ny grænse eller et ekstra felt — kun ramme det ene.
 */
export async function createItem(
  userId: string,
  input: NewItem,
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();

  let categoryId: number | null = null;
  if (input.categoryName?.trim()) {
    const { data, error } = await supabase.rpc("get_or_create_category", {
      raw_name: input.categoryName,
    });
    if (error) {
      return { error: userMessage(error, "Kategorien kunne ikke oprettes.") };
    }
    categoryId = (data as number | null) ?? null;
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      description: input.description?.trim() || null,
      category_id: categoryId,
    })
    .select("id")
    .single();

  if (itemError || !item) {
    return {
      error: userMessage(itemError, "Ejendelen kunne ikke oprettes. Prøv igen.", {
        "42501": "Du skal have et aktivt medlemskab for at oprette ejendele. Tegn eller genoptag dit medlemskab under Profil.",
      }),
    };
  }

  const serials = input.serials.map((s) => s.trim()).filter(Boolean);
  if (serials.length > 0) {
    await supabase
      .from("item_serials")
      .insert(serials.map((serial) => ({ item_id: item.id, serial })));
  }

  // Stien SKAL starte med brugerens uid — storage-policyerne kræver at
  // første mappe matcher auth.uid(), ellers afvises uploaden.
  const upload = async (bucket: string, table: string, files: File[]) => {
    for (const file of files) {
      const path = `${userId}/${item.id}/${Date.now()}-${safeName(file.name)}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      // Den oprindelige fejl kastes videre. new Error(message) smider
      // koden væk, og uden den kan oversætteren ikke se hvad der gik galt.
      if (error) throw error;
      await supabase
        .from(table)
        .insert({ item_id: item.id, file_path: path, file_name: file.name });
    }
  };

  try {
    await upload("item-images", "item_images", input.images);
    await upload("item-documents", "item_documents", input.documents);
  } catch (caught) {
    // Ejendelen ER oprettet. Filerne mangler, men brugeren kan tilføje dem
    // bagefter — bedre end at rulle alt tilbage og miste indtastningen.
    return {
      id: item.id,
      error: userMessage(
        caught,
        "Filerne kunne ikke lægges op. Du kan tilføje dem under ejendelen.",
      ),
    };
  }

  return { id: item.id };
}
