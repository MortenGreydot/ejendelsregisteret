"use client";

import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { invokeFunction } from "@/lib/functions";

const CONFIRM_WORD = "SLET";

/**
 * Permanent sletning af kontoen.
 *
 * Bekræftelsen kræver at brugeren skriver et ord, ikke bare klikker. En
 * confirm()-dialog afvises refleksmæssigt, og det her kan ikke fortrydes:
 * abonnementet opsiges, og alle ejendele, billeder og kvitteringer slettes.
 */
export function DeleteAccount({ itemCount }: { itemCount: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setConfirmText("");
    setError(null);
    dialogRef.current?.showModal();
  }

  async function handleDelete() {
    setPending(true);
    setError(null);

    // invokeFunction pakker svaret ud og oversætter fejlen. Tidligere lå den
    // logik her i en kopi, og den kopi kendte ikke oversættelsen.
    const { data, error: callError } = await invokeFunction<{
      deleted?: boolean;
    }>("delete-account");

    if (callError || !data?.deleted) {
      setError(
        callError ??
          "Kontoen kunne ikke slettes. Prøv igen — skriv til os hvis det bliver ved.",
      );
      setPending(false);
      return;
    }

    // Sessionen peger nu på en bruger der ikke findes.
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="h-11 w-full rounded-sm border border-line bg-white text-[15px] font-medium text-red-600 transition-colors hover:border-red-300"
      >
        Slet profil
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="slet-titel"
        onClick={(e) => {
          if (e.target === dialogRef.current && !pending)
            dialogRef.current?.close();
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-sm border-0 bg-transparent p-0 backdrop:bg-[#3d3d3d]/85"
      >
        <div className="max-h-[90dvh] overflow-y-auto rounded-sm bg-white p-5 sm:p-8">
          <span className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <TriangleAlert className="size-5" strokeWidth={2} />
          </span>

          <h2
            id="slet-titel"
            className="mt-4 font-display text-[22px] font-normal text-navy"
          >
            Slet din profil permanent
          </h2>

          <p className="mt-3 text-[15px] leading-relaxed text-body">
            Det følgende slettes og kan ikke gendannes:
          </p>

          <ul className="mt-3 space-y-1.5 text-[14px] text-body">
            <li>&bull; Dit abonnement opsiges med det samme</li>
            <li>
              &bull; {itemCount} registrerede{" "}
              {itemCount === 1 ? "ejendel" : "ejendele"}
            </li>
            <li>&bull; Alle billeder, serienumre og kvitteringer</li>
            <li>&bull; Din profil og login</li>
          </ul>

          <p className="mt-4 text-[14px] text-muted">
            Har du dokumentation du får brug for til en forsikringssag, så hent
            den ned først. Den kan ikke skaffes igen bagefter.
          </p>

          <label
            htmlFor="slet-bekraeft"
            className="mt-5 block text-[14px] font-semibold text-navy"
          >
            Skriv <span className="font-mono">{CONFIRM_WORD}</span> for at
            bekræfte
          </label>
          <input
            id="slet-bekraeft"
            value={confirmText}
            disabled={pending}
            autoComplete="off"
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2 h-11 w-full rounded-sm border border-line px-5 font-mono text-[15px] text-navy focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
          />

          {error && (
            <p role="alert" className="mt-3 text-[14px] text-red-600">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending || confirmText.trim() !== CONFIRM_WORD}
              className="h-11 flex-1 rounded-sm bg-red-600 text-[15px] font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
            >
              {pending ? "Sletter…" : "Slet permanent"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
              className="h-11 flex-1 rounded-sm border border-line text-[15px] font-medium text-navy transition-colors hover:border-navy disabled:opacity-60"
            >
              Annuller
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
