"use client";

import {
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  Pencil,
  ShieldAlert,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

import type { Category } from "./CategoryCombobox";
import { InfoHint } from "./InfoHint";
import { ItemDetails } from "./ItemDetails";

export type ItemStatus = "registered" | "lost" | "stolen";

export type Item = {
  id: string;
  name: string;
  brand: string | null;
  status: ItemStatus;
  status_changed_at: string | null;
  created_at: string;
  category: string | null;
  serials: string[];
  imageUrl: string | null;
};

/** Hentes først når brugeren åbner eller redigerer ejendelen. */
export type ItemDetail = {
  description: string | null;
  images: { path: string; url: string }[];
  documents: { name: string; path: string; url: string | null }[];
};

const STATUS = {
  registered: {
    label: "Registreret",
    badge: "bg-emerald-50 text-emerald-700",
    banner: null,
  },
  lost: {
    label: "Meldt savnet",
    badge: "bg-amber-50 text-amber-700",
    banner: "border-amber-400 bg-amber-50/60 text-amber-800",
  },
  stolen: {
    label: "Meldt stjålet",
    badge: "bg-red-50 text-red-700",
    banner: "border-red-400 bg-red-50/60 text-red-800",
  },
} as const;

const dk = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("da-DK", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

export function ItemList({
  items,
  userId,
  categories,
}: {
  items: Item[];
  userId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ItemDetail>>({});
  const [loading, setLoading] = useState<string | null>(null);

  /**
   * Henter detaljerne første gang de skal bruges.
   *
   * Listen henter kun det kortet viser. Beskrivelse, kvitteringer og de
   * øvrige billeder ville ellers blive hentet for hver eneste ejendel ved
   * hver sideindlæsning, selvom de fleste aldrig bliver åbnet.
   *
   * Kaldes fra klik-handleren og ikke fra en effect: det holder hentningen
   * knyttet til brugerens handling og undgår en ekstra render-runde.
   */
  async function loadDetail(id: string, force = false) {
    if (!force && details[id]) return details[id];

    setLoading(id);
    const supabase = createClient();
    const { data } = await supabase
      .from("items")
      .select(
        "description, item_images(file_path, created_at), item_documents(file_name, file_path)",
      )
      .eq("id", id)
      .single();
    setLoading(null);

    const row = data as unknown as {
      description: string | null;
      item_images: { file_path: string; created_at: string }[] | null;
      item_documents: { file_name: string | null; file_path: string }[] | null;
    } | null;

    const docs = row?.item_documents ?? [];

    // Kvitteringer ligger privat og kan ikke vises som billeder uden en
    // signeret URL. createSignedUrls signerer alle stier i ét kald frem for
    // ét pr. fil, og levetiden holdes kort — linket ligger i HTML'en, så det
    // skal ikke være brugbart længere end sessionen varer.
    let signed: Record<string, string> = {};
    if (docs.length > 0) {
      const { data: urls } = await supabase.storage
        .from("item-documents")
        .createSignedUrls(
          docs.map((d) => d.file_path),
          600,
        );
      signed = Object.fromEntries(
        (urls ?? []).flatMap((u) =>
          u.path && u.signedUrl ? [[u.path, u.signedUrl] as const] : [],
        ),
      );
    }

    const detail: ItemDetail = {
      description: row?.description ?? null,
      images: [...(row?.item_images ?? [])]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((img) => ({
          path: img.file_path,
          url: supabase.storage.from("item-images").getPublicUrl(img.file_path)
            .data.publicUrl,
        })),
      documents: docs.map((d) => ({
        name: d.file_name ?? d.file_path.split("/").pop() ?? "Dokument",
        path: d.file_path,
        url: signed[d.file_path] ?? null,
      })),
    };

    setDetails((prev) => ({ ...prev, [id]: detail }));
    return detail;
  }

  async function toggle(id: string) {
    if (open.has(id)) {
      setOpen((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    await loadDetail(id);
    setOpen((prev) => new Set(prev).add(id));
  }

  async function startEdit(id: string) {
    if (editing === id) {
      setEditing(null);
      return;
    }
    await loadDetail(id);
    setEditing(id);
    setOpen((prev) => new Set(prev).add(id));
  }

  async function updateStatus(item: Item) {
    // Cykler gennem de tre tilstande. En rigtig dialog med note hører til
    // "Opdater status", men rækkefølgen her matcher det almindelige forløb.
    const next: ItemStatus =
      item.status === "registered"
        ? "lost"
        : item.status === "lost"
          ? "stolen"
          : "registered";

    setBusy(item.id);
    const supabase = createClient();
    await supabase
      .from("items")
      .update({ status: next, status_changed_at: new Date().toISOString() })
      .eq("id", item.id);
    setBusy(null);
    router.refresh();
  }

  /**
   * Sletter ejendelen og dens filer.
   *
   * ON DELETE CASCADE rydder item_images, item_documents og item_serials i
   * databasen, men Storage er et separat system som cascade ikke rører.
   * Uden det her ville filerne ligge tilbage for evigt — utilgængelige,
   * men stadig talt med i lagerkvoten.
   *
   * Rækkefølgen er bevidst: stierne hentes FØR sletningen (bagefter er de
   * væk), rækken slettes, og til sidst filerne. Fejler storage-kaldet, står
   * der en forældreløs fil tilbage — usynlig og harmløs. Slettede vi filerne
   * først og rækken derefter fejlede, ville brugeren sidde med en ejendel
   * hvis billeder er permanent brudte.
   */
  async function remove(item: Item) {
    if (!confirm(`Slet "${item.name}"? Det kan ikke fortrydes.`)) return;
    setBusy(item.id);
    const supabase = createClient();

    const { data: files } = await supabase
      .from("items")
      .select("item_images(file_path), item_documents(file_path)")
      .eq("id", item.id)
      .single();

    const paths = files as unknown as {
      item_images: { file_path: string }[] | null;
      item_documents: { file_path: string }[] | null;
    } | null;

    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      setBusy(null);
      return;
    }

    const imagePaths = (paths?.item_images ?? []).map((f) => f.file_path);
    const documentPaths = (paths?.item_documents ?? []).map((f) => f.file_path);

    // Ét kald pr. bucket frem for ét pr. fil.
    await Promise.all([
      imagePaths.length > 0
        ? supabase.storage.from("item-images").remove(imagePaths)
        : null,
      documentPaths.length > 0
        ? supabase.storage.from("item-documents").remove(documentPaths)
        : null,
    ]);

    setBusy(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="rounded-sm border border-line bg-white px-6 py-10 text-center text-[15px] text-muted">
        Du har ingen ejendele registreret endnu.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const style = STATUS[item.status];
        const isOpen = open.has(item.id);

        return (
          <li
            key={item.id}
            className={
              style.banner
                ? `rounded-sm border border-l-4 ${style.banner.split(" ")[0]} border-y-line border-r-line bg-white`
                : "rounded-sm border border-line bg-white"
            }
          >
            {style.banner && (
              <p
                className={`flex items-center gap-2 rounded-t-[3px] px-4 py-2 text-[13px] font-semibold ${style.banner}`}
              >
                {item.status === "stolen" ? (
                  <ShieldAlert className="size-3.5" strokeWidth={2} />
                ) : (
                  <TriangleAlert className="size-3.5" strokeWidth={2} />
                )}
                {style.label}
                <span className="font-normal opacity-80">
                  · siden {dk(item.status_changed_at)}
                </span>
              </p>
            )}

            <div className="flex gap-4 p-4">
              <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-mist text-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <Package className="size-7" strokeWidth={1.25} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-display text-[18px] font-bold text-navy">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {[item.brand, item.category].filter(Boolean).join(" · ") ||
                        "—"}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <span
                      className={`inline-block rounded-sm px-2 py-1 text-[12px] font-semibold ${style.badge}`}
                    >
                      {style.label}
                    </span>
                    <p className="mt-1 text-[12px] text-muted sm:mt-1.5">
                      Tilføjet {item.created_at.slice(0, 10)}
                    </p>
                  </div>
                </div>

                {item.serials.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-2">
                    {item.serials.map((serial) => (
                      <span
                        key={serial}
                        className="rounded-sm bg-mist px-2 py-1 font-mono text-[12px] text-body"
                      >
                        SN: {serial}
                      </span>
                    ))}
                  </p>
                )}

                {loading === item.id && (
                  <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
                    Henter detaljer…
                  </p>
                )}

                {(isOpen || editing === item.id) && details[item.id] && (
                  <ItemDetails
                    item={item}
                    userId={userId}
                    detail={details[item.id]}
                    categories={categories}
                    editing={editing === item.id}
                    onDone={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      setOpen((prev) => {
                        const next = new Set(prev);
                        next.delete(item.id);
                        return next;
                      });
                    }}
                    onChanged={() => loadDetail(item.id, true)}
                  />
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-0.5 border-t border-line pt-2 text-[13px] [&_button]:py-2 [&_a]:py-2">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="inline-flex items-center gap-1 text-muted transition-colors hover:text-navy"
                  >
                    {isOpen ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                    {isOpen ? "Skjul" : "Vis detaljer"}
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(item.id)}
                    className="inline-flex items-center gap-1 font-semibold text-navy transition-colors hover:text-orange"
                  >
                    <Pencil className="size-3.5" />
                    {editing === item.id ? "Afslut redigering" : "Rediger"}
                  </button>

                  <span className="relative inline-flex pr-1.5">
                    <button
                      type="button"
                      onClick={() => updateStatus(item)}
                      disabled={busy === item.id}
                      className="inline-flex items-center gap-1 text-muted transition-colors hover:text-navy disabled:opacity-40"
                    >
                      <ShieldAlert className="size-3.5" />
                      Opdater status
                    </button>
                    <InfoHint title="Opdater status">
                      Markér ejendelen som savnet eller stjålet. Statussen er
                      synlig for politiet og for en finder der slår
                      serienummeret op — så det er den du ændrer først, hvis
                      noget bliver væk.
                    </InfoHint>
                  </span>

                  <span className="relative inline-flex pr-1.5">
                    <button
                      type="button"
                      disabled
                      title="Ikke bygget endnu"
                      className="inline-flex items-center gap-1 text-muted disabled:opacity-40"
                    >
                      <FileText className="size-3.5" />
                      Bevis
                    </button>
                    <InfoHint title="Bevis">
                      Dine kvitteringer, garantibeviser og forsikringspapirer
                      for ejendelen. Det er dem du sender til forsikringen
                      eller politiet som dokumentation for ejerskab.
                    </InfoHint>
                  </span>

                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy === item.id}
                    className="ml-auto inline-flex items-center gap-1 text-red-600 transition-colors hover:text-red-700 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                    Slet
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
