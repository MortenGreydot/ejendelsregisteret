"use client";

import { FileText, ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";

/** Se MediaGrid for hvorfor HEIC bevidst ikke står i `accept`. */
const heicMessage = (formats: string) =>
  `Vi tager kun imod ${formats}. HEIC er iPhones eget format og kan ikke vises i de fleste browsere — vælg billedet via Fotos-appen frem for Filer, så konverterer iOS det automatisk til JPG.`;

const isHeic = (name: string) => /\.hei[cf]$/i.test(name.trim());

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
        <ul className="mt-2 space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-sm bg-mist px-3 py-2 text-[13px] text-body"
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-muted">
                {(file.size / 1024).toFixed(0)} kB
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                aria-label={`Fjern ${file.name}`}
                className="shrink-0 text-muted hover:text-red-600 disabled:opacity-60"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
