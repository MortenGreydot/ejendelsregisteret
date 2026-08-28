"use client";

import { FileText, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const MAX_IMAGES = 6;
const MAX_DOCUMENTS = 4;
const MAX_BYTES = 10 * 1024 * 1024;

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const DOCUMENT_ACCEPT = `${IMAGE_ACCEPT},application/pdf`;

const isImageFile = (name: string) => /\.(png|jpe?g|webp|gif)$/i.test(name.trim());

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

/**
 * HEIC/HEIF er iPhones standardformat, men kan kun vises i Safari.
 *
 * Bemærk at formatet med vilje IKKE står i `accept`: netop fordi accept kun
 * nævner JPEG/PNG/WEBP, konverterer iOS selv billedet til JPEG under upload.
 * Tilføjes image/heic, holder iOS op med at konvertere og sender originalen.
 *
 * Filer valgt gennem Filer-appen eller fra en computer slipper dog udenom,
 * og bucket'ens allowed_mime_types ville afvise dem med en teknisk fejl.
 * Derfor fanges de her med en besked der siger hvad man skal gøre.
 */
const heicMessage = (formats: string) =>
  `Vi tager kun imod ${formats}. HEIC er iPhones eget format og kan ikke vises i de fleste browsere — vælg billedet via Fotos-appen frem for Filer, så konverterer iOS det automatisk til JPG.`;

const IMAGE_FORMATS = "PNG, JPG og WEBP";
const DOCUMENT_FORMATS = "PNG, JPG, WEBP og PDF";

const isHeic = (name: string) => /\.hei[cf]$/i.test(name.trim());


const TILE =
  "relative size-28 overflow-hidden rounded-sm border border-line bg-mist";


function AddTile({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`${TILE} flex flex-col items-center justify-center gap-1 border-dashed text-muted transition-colors hover:border-orange hover:text-orange disabled:opacity-50`}
    >
      <Plus className="size-5" strokeWidth={2} />
      <span className="px-1 text-center text-[12px]">
        {busy ? "Uploader…" : label}
      </span>
    </button>
  );
}

function RemoveButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      aria-label={label}
      className="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
    >
      <X className="size-3" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Billeder og kvitteringer for en ejendel.
 *
 * Begge slags filer håndteres af de samme to funktioner — kun bucket, tabel
 * og grænse er forskellig. Uploadstien er ens: `{user_id}/{item_id}/{fil}`,
 * fordi storage-policyerne kræver at første mappe er brugerens uid.
 *
 * Tilføj og fjern vises kun i redigeringstilstand. En slet-knap i en
 * læsevisning er nem at ramme ved et uheld, og en slettet fil kan ikke
 * fortrydes.
 */
export function MediaGrid({
  itemId,
  userId,
  images,
  documents,
  editable,
  onChanged,
}: {
  itemId: string;
  userId: string;
  images: { path: string; url: string }[];
  documents: { name: string; path: string; url: string | null }[];
  editable: boolean;
  onChanged: () => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFile(
    bucket: string,
    table: string,
    path: string,
    prompt: string,
  ) {
    if (!confirm(prompt)) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();

    // Rækken slettes først. Fejler storage bagefter, står der en forældreløs
    // fil tilbage — usynlig og harmløs. Omvendt rækkefølge ville efterlade en
    // række der peger på ingenting, altså et permanent brudt element.
    const { error: rowError } = await supabase
      .from(table)
      .delete()
      .eq("item_id", itemId)
      .eq("file_path", path);

    if (rowError) {
      setError(rowError.message);
      setBusy(false);
      return;
    }

    await supabase.storage.from(bucket).remove([path]);
    setBusy(false);
    onChanged();
  }

  async function addFiles(
    bucket: string,
    table: string,
    files: FileList | null,
    room: number,
    max: number,
    formats: string,
  ) {
    if (!files || files.length === 0) return;
    setError(null);

    if (room <= 0) {
      setError(`Der kan højst være ${max} filer.`);
      return;
    }

    setBusy(true);
    const supabase = createClient();

    try {
      for (const file of Array.from(files).slice(0, room)) {
        if (isHeic(file.name)) {
          setError(heicMessage(formats));
          continue;
        }
        if (file.size > MAX_BYTES) {
          setError(`"${file.name}" er større end 10 MB.`);
          continue;
        }
        const path = `${userId}/${itemId}/${Date.now()}-${safeName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file);
        if (uploadError) {
          setError(uploadError.message);
          continue;
        }
        await supabase
          .from(table)
          .insert({ item_id: itemId, file_path: path, file_name: file.name });
      }
      if (files.length > room) {
        setError(`Kun ${room} fil(er) blev tilføjet — grænsen er ${max}.`);
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-semibold text-navy">
          Billeder{" "}
          <span className="font-normal text-muted">
            ({images.length}/{MAX_IMAGES})
          </span>
        </p>

        <ul className="mt-2 flex flex-wrap gap-3">
          {images.map((img, i) => (
            <li key={img.path} className={TILE}>
              <Image
                src={img.url}
                alt={`Billede ${i + 1}`}
                fill
                sizes="112px"
                className="object-cover"
              />
              {editable && (
                <RemoveButton
                  busy={busy}
                  label={`Fjern billede ${i + 1}`}
                  onClick={() =>
                    removeFile(
                      "item-images",
                      "item_images",
                      img.path,
                      "Fjern billedet? Det kan ikke fortrydes.",
                    )
                  }
                />
              )}
            </li>
          ))}

          {editable && images.length < MAX_IMAGES && (
            <li>
              <AddTile
                busy={busy}
                label="Tilføj billeder"
                onClick={() => imageInput.current?.click()}
              />
              <input
                ref={imageInput}
                type="file"
                accept={IMAGE_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(
                    "item-images",
                    "item_images",
                    e.target.files,
                    MAX_IMAGES - images.length,
                    MAX_IMAGES,
                    IMAGE_FORMATS,
                  );
                  e.target.value = "";
                }}
              />
            </li>
          )}

          {images.length === 0 && !editable && (
            <li className="text-[13px] text-muted">Ingen billeder</li>
          )}
        </ul>
      </div>

      <div>
        <p className="text-[13px] font-semibold text-navy">
          Kvitteringer{" "}
          <span className="font-normal text-muted">
            ({documents.length}/{MAX_DOCUMENTS})
          </span>
        </p>

        <ul className="mt-2 flex flex-wrap gap-3">
          {documents.map((doc, i) => (
            <li key={doc.path} className={TILE}>
              <a
                href={doc.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                title={doc.name}
                className="block size-full transition-opacity hover:opacity-80"
              >
                {isImageFile(doc.name) && doc.url ? (
                  <Image
                    src={doc.url}
                    alt={doc.name}
                    fill
                    sizes="112px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-muted">
                    <FileText className="size-6" strokeWidth={1.5} />
                    <span className="line-clamp-2 text-center text-[11px] break-all">
                      {doc.name}
                    </span>
                  </span>
                )}
              </a>
              {editable && (
                <RemoveButton
                  busy={busy}
                  label={`Fjern kvittering ${i + 1}`}
                  onClick={() =>
                    removeFile(
                      "item-documents",
                      "item_documents",
                      doc.path,
                      "Fjern kvitteringen? Det kan ikke fortrydes.",
                    )
                  }
                />
              )}
            </li>
          ))}

          {editable && documents.length < MAX_DOCUMENTS && (
            <li>
              <AddTile
                busy={busy}
                label="Tilføj kvittering"
                onClick={() => documentInput.current?.click()}
              />
              <input
                ref={documentInput}
                type="file"
                accept={DOCUMENT_ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => {
                  addFiles(
                    "item-documents",
                    "item_documents",
                    e.target.files,
                    MAX_DOCUMENTS - documents.length,
                    MAX_DOCUMENTS,
                    DOCUMENT_FORMATS,
                  );
                  e.target.value = "";
                }}
              />
            </li>
          )}

          {documents.length === 0 && !editable && (
            <li className="text-[13px] text-muted">Ingen kvitteringer</li>
          )}
        </ul>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
