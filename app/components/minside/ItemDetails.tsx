"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { userMessage } from "@/lib/errors";

import { CategoryCombobox, type Category } from "./CategoryCombobox";
import { MediaGrid } from "./MediaGrid";
import type { Item, ItemDetail } from "./ItemList";

const fieldClass =
  "mt-2 w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";
const labelClass = "block text-[13px] font-semibold text-navy";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-line py-2 last:border-0">
      <dt className="w-36 shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-[14px] text-body">{value || "—"}</dd>
    </div>
  );
}

export function ItemDetails({
  item,
  userId,
  detail,
  categories,
  editing,
  onDone,
  onSaved,
  onChanged,
}: {
  item: Item;
  userId: string;
  detail: ItemDetail;
  categories: Category[];
  editing: boolean;
  /** Fortryd: tilbage til visning, kortet forbliver åbent. */
  onDone: () => void;
  /** Gemt: luk både redigering og detaljevisning. */
  onSaved: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(item.category ?? "");
  const [serials, setSerials] = useState<string[]>(
    item.serials.length > 0 ? item.serials : [""],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    try {
      let categoryId: number | null = null;
      if (category.trim() !== "") {
        const { data: id, error: catError } = await supabase.rpc(
          "get_or_create_category",
          { raw_name: category },
        );
        if (catError) {
          setError(
            userMessage(catError, "Kategorien kunne ikke oprettes."),
          );
          return;
        }
        categoryId = (id as number | null) ?? null;
      }

      const { error: updateError } = await supabase
        .from("items")
        .update({
          name: String(form.get("navn")).trim(),
          brand: String(form.get("maerke") ?? "").trim() || null,
          description: String(form.get("beskrivelse") ?? "").trim() || null,
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) {
        setError(
          userMessage(updateError, "Ændringerne kunne ikke gemmes.", {
            "42501": "Du kan kun redigere dine egne ejendele.",
          }),
        );
        return;
      }

      // Serienumre erstattes samlet. Der er højst en håndfuld, og det er
      // enklere og mere forudsigeligt end at regne ud hvad der er ændret.
      const cleaned = serials.map((s) => s.trim()).filter(Boolean);
      await supabase.from("item_serials").delete().eq("item_id", item.id);
      if (cleaned.length > 0) {
        await supabase
          .from("item_serials")
          .insert(cleaned.map((serial) => ({ item_id: item.id, serial })));
      }

      onSaved();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <MediaGrid
          itemId={item.id}
          userId={userId}
          images={detail.images}
          documents={detail.documents}
          editable={false}
          onChanged={onChanged}
        />

        <dl>
          <Row label="Mærke" value={item.brand} />
          <Row label="Kategori" value={item.category} />
          <Row
            label="Serienumre"
            value={
              item.serials.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {item.serials.map((s) => (
                    <span
                      key={s}
                      className="rounded-sm bg-mist px-2 py-0.5 font-mono text-[12px]"
                    >
                      {s}
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
          <Row label="Beskrivelse" value={detail.description} />
        </dl>

        {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-4 border-t border-line pt-4"
    >
      <MediaGrid
        itemId={item.id}
        userId={userId}
        images={detail.images}
        documents={detail.documents}
        editable
        onChanged={onChanged}
      />

      <div>
        <label htmlFor={`navn-${item.id}`} className={labelClass}>
          Navn
        </label>
        <input
          id={`navn-${item.id}`}
          name="navn"
          required
          disabled={pending}
          defaultValue={item.name}
          className={`h-10 ${fieldClass}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`maerke-${item.id}`} className={labelClass}>
            Mærke / fabrikant
          </label>
          <input
            id={`maerke-${item.id}`}
            name="maerke"
            disabled={pending}
            defaultValue={item.brand ?? ""}
            className={`h-10 ${fieldClass}`}
          />
        </div>
        <div>
          <span className={labelClass}>Kategori</span>
          <CategoryCombobox
            categories={categories}
            value={category}
            onChange={setCategory}
            disabled={pending}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`besk-${item.id}`} className={labelClass}>
          Beskrivelse
        </label>
        <textarea
          id={`besk-${item.id}`}
          name="beskrivelse"
          rows={3}
          disabled={pending}
          defaultValue={detail.description ?? ""}
          className={`resize-y py-2 ${fieldClass}`}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={labelClass}>Serienumre</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setSerials((s) => [...s, ""])}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-orange hover:text-orange-dark"
          >
            <Plus className="size-3" strokeWidth={2.5} />
            Tilføj
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {serials.map((serial, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={serial}
                disabled={pending}
                aria-label={`Serienummer ${index + 1}`}
                onChange={(e) =>
                  setSerials((s) =>
                    s.map((v, i) => (i === index ? e.target.value : v)),
                  )
                }
                className={`mt-0 h-10 font-mono ${fieldClass}`}
              />
              {serials.length > 1 && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Fjern serienummer"
                  onClick={() =>
                    setSerials((s) => s.filter((_, i) => i !== index))
                  }
                  className="text-muted hover:text-red-600"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-sm bg-orange px-6 text-[14px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
        >
          {pending ? "Gemmer…" : "Gem ændringer"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="h-10 rounded-sm border border-line px-6 text-[14px] font-medium text-navy transition-colors hover:border-navy"
        >
          Annuller
        </button>
      </div>
    </form>
  );
}
