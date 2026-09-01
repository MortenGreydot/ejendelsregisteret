"use client";

import { FileText, ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Se MediaGrid for hvorfor HEIC bevidst ikke står i `accept`. */
const heicMessage = (formats: string) =>
  `Vi tager kun imod ${formats}. HEIC er iPhones eget format og kan ikke vises i de fleste browsere — vælg billedet via Fotos-appen frem for Filer, så konverterer iOS det automatisk til JPG.`;

const isHeic = (name: string) => /\.hei[cf]$/i.test(name.trim());

/** Samme flise som MediaGrid, så oprettelse og redigering ser ens ud. */
const TILE =
  "relative size-36 overflow-hidden rounded-sm border border-line bg-mist";

const isImageFile = (name: string) =>
  /\.(png|jpe?g|webp|gif)$/i.test(name.trim());

/**
 * Miniature af en fil der endnu ikke er lagt op.
 *
 * Filen findes kun i browseren, så der er ingen URL at hente fra. src sættes
 * derfor direkte på elementet inde i effekten frem for gennem state.
 *
 * Grunden er levetiden: en object-URL skal frigives igen, ellers holder
 * browseren på hele filen indtil siden genindlæses. Bliver URL'en lagt i
 * state eller useMemo, peger den stadig på en frigivet URL næste gang
 * effekten kører — og i udvikling kører React netop hver effekt to gange.
 * Ved at oprette og frigive i samme effekt følges de altid ad.
 */
function ImagePreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    // next/image kan ikke bruges her: kilden er en object-URL der først
    // findes efter mount, og den skal ikke gennem billedoptimeringen.
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={imgRef} alt={file.name} className="size-full object-cover" />
  );
}

/** Fliser for filer uden miniature — typisk en PDF-kvittering. */
function DocumentPreview({ file }: { file: File }) {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-center">
      <FileText className="size-6 shrink-0 text-muted" strokeWidth={1.5} />
      <span className="line-clamp-2 text-[11px] leading-tight break-all text-body">
        {file.name}
      </span>
    </span>
  );
}

export function FileDropzone({
  id,
  accept,
  maxFiles,
  maxBytes,
  formats,
  hint,
  label,
  icon,
  files,
  onChange,
  disabled,
}: {
  id: string;
  accept: string;
  maxFiles: number;
  maxBytes: number;
  /** Menneskeligt læsbar liste, fx "PNG, JPG og WEBP". */
  formats: string;
  hint: string;
  label: string;
  icon: "image" | "document";
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(incoming: FileList | null) {
    if (!incoming) return;
    setError(null);

    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= maxFiles) {
        setError(`Højst ${maxFiles} filer.`);
        break;
      }
      if (isHeic(file.name)) {
        setError(heicMessage(formats));
        continue;
      }
      if (file.size > maxBytes) {
        setError(`"${file.name}" er større end ${maxBytes / 1024 / 1024} MB.`);
        continue;
      }
      next.push(file);
    }
    onChange(next);
  }

  const Icon = icon === "image" ? ImageIcon : FileText;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        className={`rounded-sm border border-dashed px-6 py-8 text-center transition-colors ${
          over ? "border-orange bg-orange/5" : "border-line bg-mist/40"
        } ${disabled ? "opacity-60" : ""}`}
      >
        <Icon className="mx-auto size-6 text-muted" strokeWidth={1.5} />
        <p className="mt-3 text-[15px] text-body">
          {label}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-orange hover:text-orange-dark disabled:opacity-60"
          >
            klik for at vælge
          </button>
        </p>
        <p className="mt-1 text-[13px] text-muted">{hint}</p>

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple
          disabled={disabled}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </div>

      {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}

      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              title={`${file.name} · ${(file.size / 1024).toFixed(0)} kB`}
              className={TILE}
            >
              {isImageFile(file.name) ? (
                <ImagePreview file={file} />
              ) : (
                <DocumentPreview file={file} />
              )}

              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Fjern ${file.name}`}
                className="absolute top-1 right-1 z-10 flex size-5 items-center justify-center rounded-full bg-white/90 text-navy shadow-sm transition-colors hover:bg-red-600 hover:text-white disabled:opacity-50"
              >
                <X className="size-3" strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
