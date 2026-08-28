"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { CategoryCombobox, type Category } from "./CategoryCombobox";
import { FileDropzone } from "./FileDropzone";

export type { Category };

const MB = 1024 * 1024;

const fieldClass =
  "mt-2 w-full rounded-sm border border-line bg-white px-3.5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";
const labelClass = "block text-[14px] font-semibold text-navy";

export function AddItemDialog({
  userId,
  categories,
  itemCount,
  includedItems,
  extraItemPrice,
  canAddItems,
}: {
  userId: string;
  categories: Category[];
  itemCount: number;
  includedItems: number;
  extraItemPrice: number;
  /** Falsk når medlemskabet ikke er aktivt. Databasen spærrer også, men
   *  en deaktiveret knap forklarer hvorfor frem for at fejle ved gem. */
  canAddItems: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  /**
   * Spærre mod dobbelt-indsendelse.
   *
   * `pending` er state, og state opdateres asynkront — to hurtige klik kan
   * begge nå ind i save() før knappen når at blive deaktiveret, og så
   * oprettes ejendelen to gange. En ref opdateres synkront og lukker hullet.
   */
  const savingRef = useRef(false);
  const router = useRouter();

  const [category, setCategory] = useState("");
  const [serials, setSerials] = useState<string[]>([""]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kvoten er brugt op når man har lige så mange ejendele som medlemskabet
  // inkluderer. Den næste koster ekstra, og det afgøres af hvilken knap
  // brugeren trykker på — ikke af en dialog der afbryder dem.
  const atLimit = itemCount >= includedItems;

  function open() {
    setCategory("");
    setSerials([""]);
    setImages([]);
    setDocuments([]);
    setError(null);
    dialogRef.current?.showModal();
  }


  function close() {
    if (!pending) dialogRef.current?.close();
  }

  /** Filnavne skal være sikre at bruge som storage-nøgle. */
  function safeName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    try {
      // Databasen normaliserer og opretter kategorien hvis den ikke findes.
      // Klienten sender rå tekst; trim, mellemrum og versaler håndteres i
      // get_or_create_category, så to brugere ikke kan lave hver sin variant
      // af samme navn samtidig.
      let categoryId: number | null = null;
      if (category.trim() !== "") {
        const { data: id, error: categoryError } = await supabase.rpc(
          "get_or_create_category",
          { raw_name: category },
        );
        if (categoryError) {
          setError(categoryError.message);
          return;
        }
        categoryId = (id as number | null) ?? null;
      }

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          user_id: userId,
          name: String(form.get("navn")).trim(),
          brand: String(form.get("maerke") ?? "").trim() || null,
          description: String(form.get("beskrivelse") ?? "").trim() || null,
          category_id: categoryId,
        })
        .select("id")
        .single();

      if (itemError || !item) {
        setError(itemError?.message ?? "Kunne ikke oprette ejendelen.");
        return;
      }

      const cleanSerials = serials.map((s) => s.trim()).filter(Boolean);
      if (cleanSerials.length > 0) {
        await supabase
          .from("item_serials")
          .insert(cleanSerials.map((serial) => ({ item_id: item.id, serial })));
      }

      // Stien SKAL starte med brugerens uid — storage-policyerne kræver at
      // første mappe matcher auth.uid(), ellers afvises uploaden.
      const upload = async (
        bucket: string,
        table: string,
        files: File[],
      ) => {
        for (const file of files) {
          const path = `${userId}/${item.id}/${Date.now()}-${safeName(file.name)}`;
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(path, file);
          if (uploadError) throw new Error(uploadError.message);
          await supabase
            .from(table)
            .insert({ item_id: item.id, file_path: path, file_name: file.name });
        }
      };

      await upload("item-images", "item_images", images);
      await upload("item-documents", "item_documents", documents);

      dialogRef.current?.close();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {atLimit && canAddItems && (
          <span className="text-[13px] text-muted">
            {itemCount} af {includedItems} brugt &middot; ekstra ejendele koster{" "}
            {extraItemPrice} kr./md. pr. stk.
          </span>
        )}

        <button
          type="button"
          onClick={open}
          disabled={atLimit || !canAddItems}
          title={
            !canAddItems
              ? "Dit medlemskab er ikke aktivt. Gennemfør betalingen for at oprette ejendele."
              : atLimit
                ? `Dit medlemskab inkluderer ${includedItems} ejendele. Brug "Tilkøb ejendel" for at oprette flere.`
                : undefined
          }
          className="inline-flex h-10 items-center gap-2 rounded-sm bg-orange px-5 text-[15px] font-medium text-white transition-colors hover:bg-orange-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:hover:bg-line"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Tilføj ejendel
        </button>

        {atLimit && canAddItems && (
          <button
            type="button"
            onClick={open}
            className="inline-flex h-10 items-center gap-2 rounded-sm border border-orange px-5 text-[15px] font-medium text-orange transition-colors hover:bg-orange hover:text-white"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Tilkøb ejendel
          </button>
        )}
      </div>


      <dialog
        ref={dialogRef}
        aria-labelledby="tilfoej-titel"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto w-[min(46rem,calc(100vw-2rem))] overflow-hidden rounded-sm border-0 bg-transparent p-0 backdrop:bg-[#3d3d3d]/85"
      >
        <form
          onSubmit={handleSubmit}
          className="max-h-[85vh] overflow-y-auto rounded-sm bg-white p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <h2
              id="tilfoej-titel"
              className="font-display text-[26px] font-normal text-navy"
            >
              Tilføj ny ejendel
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Luk"
              className="text-muted transition-colors hover:text-navy"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="ny-navn" className={labelClass}>
                Navn på ejendel <span className="text-orange">*</span>
              </label>
              <input
                id="ny-navn"
                name="navn"
                required
                disabled={pending}
                placeholder={'f.eks. MacBook Pro 14"'}
                className={`h-11 ${fieldClass}`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ny-maerke" className={labelClass}>
                  Mærke / fabrikant
                </label>
                <input
                  id="ny-maerke"
                  name="maerke"
                  disabled={pending}
                  placeholder="f.eks. Apple"
                  className={`h-11 ${fieldClass}`}
                />
              </div>
              <div>
                <label htmlFor="ny-kategori" className={labelClass}>
                  Kategori
                </label>
                <CategoryCombobox
                  categories={categories}
                  value={category}
                  onChange={setCategory}
                  disabled={pending}
                />
              </div>
            </div>

            <div>
              <label htmlFor="ny-beskrivelse" className={labelClass}>
                Beskrivelse
              </label>
              <textarea
                id="ny-beskrivelse"
                name="beskrivelse"
                rows={4}
                disabled={pending}
                placeholder="Farve, model, størrelse, særlige kendetegn…"
                className={`resize-y py-3 ${fieldClass}`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <span className={labelClass}>Serienumre</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setSerials((s) => [...s, ""])}
                  className="inline-flex items-center gap-1 text-[14px] font-semibold text-orange hover:text-orange-dark disabled:opacity-60"
                >
                  <Plus className="size-3.5" strokeWidth={2.5} />
                  Tilføj serienummer
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {serials.map((serial, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-[12px] text-muted">
                        SN
                      </span>
                      <input
                        value={serial}
                        disabled={pending}
                        onChange={(e) =>
                          setSerials((s) =>
                            s.map((v, i) => (i === index ? e.target.value : v)),
                          )
                        }
                        aria-label={`Serienummer ${index + 1}`}
                        placeholder="f.eks. C02GS123MDMQ"
                        className={`h-11 pl-10 font-mono ${fieldClass} mt-0`}
                      />
                    </div>
                    {serials.length > 1 && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          setSerials((s) => s.filter((_, i) => i !== index))
                        }
                        aria-label="Fjern serienummer"
                        className="text-muted hover:text-red-600 disabled:opacity-60"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[13px] text-muted">
                Har genstanden flere dele med hvert sit serienummer (f.eks.
                kamera + objektiv), kan du tilføje dem alle.
              </p>
            </div>

            <div>
              <span className={labelClass}>Billeder</span>
              <div className="mt-2">
                <FileDropzone
                  id="ny-billeder"
                  accept="image/png,image/jpeg,image/webp"
                  maxFiles={6}
                  maxBytes={10 * MB}
                  formats="PNG, JPG og WEBP"
                  label="Træk billeder herind, eller"
                  hint="PNG, JPG op til 10 MB · Maks 6 billeder"
                  icon="image"
                  files={images}
                  onChange={setImages}
                  disabled={pending}
                />
              </div>
            </div>

            <div>
              <span className={labelClass}>Kvittering / dokumentation</span>
              <p className="mt-1 text-[14px] leading-relaxed text-body">
                Upload et foto eller scan af din kvittering, garantibevis eller
                forsikringsdokument &mdash; så har du alt samlet digitalt og
                behøver ikke gemme det fysiske papir.
              </p>
              <div className="mt-2">
                <FileDropzone
                  id="ny-dokumenter"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  maxFiles={4}
                  maxBytes={10 * MB}
                  formats="PNG, JPG, WEBP og PDF"
                  label="Træk kvitteringsfoto herind, eller"
                  hint="PNG, JPG, PDF · Maks 4 filer"
                  icon="document"
                  files={documents}
                  onChange={setDocuments}
                  disabled={pending}
                />
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-5 text-[14px] text-red-600">
              {error}
            </p>
          )}

          <div className="mt-7 flex gap-3 border-t border-line pt-6">
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-sm bg-orange px-7 text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
            >
              {pending ? "Gemmer…" : "Gem ejendel"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="h-11 rounded-sm border border-line px-7 text-[16px] font-medium text-navy transition-colors hover:border-navy disabled:opacity-60"
            >
              Annuller
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
