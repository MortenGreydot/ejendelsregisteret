"use client";

import { ArrowLeft, ArrowRight, Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createItem } from "@/lib/items";

import { CategoryCombobox, type Category } from "./CategoryCombobox";
import { AddItemTrigger } from "./AddItemTrigger";
import { FileDropzone } from "./FileDropzone";

const MB = 1024 * 1024;

const fieldClass =
  "mt-2 w-full rounded-sm border border-line bg-white px-3.5 text-[16px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";
const labelClass = "block text-[14px] font-semibold text-navy";

/**
 * Trinvis oprettelse af en ejendel.
 *
 * Ét spørgsmål ad gangen frem for hele formularen på én skærm. På mobil er
 * forskellen stor: en lang formular kræver at man tager stilling til alt på
 * forhånd og scroller frem og tilbage, mens et trin ad gangen kan besvares
 * med tommelfingeren.
 *
 * Alle trin efter det første kan springes over. Et serienummer man ikke har
 * ved hånden, må ikke kunne stoppe registreringen — det kan tilføjes senere.
 *
 * Gemmelogikken ligger i lib/items.ts og deles med den almindelige dialog.
 */
const STEPS = ["Genstand", "Kategori", "Serienummer", "Billeder", "Kvittering"];

export function ItemWizard({
  userId,
  categories,
  itemCount = 0,
  includedItems,
  extraItemPrice,
  autoOpen = false,
  showIntro = false,
  skipHref,
  trigger,
  showTrigger = false,
  canAddItems = true,
  onCreated,
}: {
  userId: string;
  categories: Category[];
  /** Antal ejendele brugeren havde da guiden blev åbnet. */
  itemCount?: number;
  includedItems: number;
  extraItemPrice: number;
  /** Åbner af sig selv — bruges i onboardingen. */
  autoOpen?: boolean;
  /** Viser et velkomsttrin før felterne. Bruges kun i onboardingen; åbner
   *  man guiden fra en knap, har man allerede valgt at oprette noget. */
  showIntro?: boolean;
  /** Hvor "Spring over" fører hen. Uden den lukkes dialogen bare. */
  skipHref?: string;
  trigger?: React.ReactNode;
  /** Viser den fælles opret-knap over guiden. Bruges på små skærme, hvor
   *  guiden træder i stedet for den almindelige dialog. */
  showTrigger?: boolean;
  /** Kun relevant sammen med showTrigger: gråner knappen uden aktivt
   *  medlemskab, ligesom i dialogen. */
  canAddItems?: boolean;
  onCreated?: () => void;
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

  const [phase, setPhase] = useState<"intro" | "steps" | "done">(
    showIntro ? "intro" : "steps",
  );
  const [createdCount, setCreatedCount] = useState(0);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [serials, setSerials] = useState<string[]>([""]);
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);

  useEffect(() => {
    if (autoOpen) dialogRef.current?.showModal();
  }, [autoOpen]);

  function skip() {
    dialogRef.current?.close();
    if (skipHref) router.push(skipHref);
  }

  function resetFields() {
    setName("");
    setBrand("");
    setCategory("");
    setSerials([""]);
    setImages([]);
    setDocuments([]);
    setError(null);
    setStep(0);
  }

  /** Ja tak — samme guide forfra med tomme felter. */
  function again() {
    savingRef.current = false;
    resetFields();
    setPhase("steps");
  }

  /**
   * Nej tak — luk og opdatér siden bagved.
   *
   * refresh() sker først HER, ikke når ejendelen gemmes. Guiden vises kun
   * så længe brugeren har nul ejendele, så en refresh midt i forløbet ville
   * fjerne komponenten under sig selv og lukke dialogen efter første ejendel.
   */
  function finish() {
    dialogRef.current?.close();
    onCreated?.();
    router.refresh();
  }

  // Hvad brugeren har i alt lige nu — inklusive dem der er oprettet i
  // denne omgang, som siden bagved endnu ikke har talt med.
  const totalItems = itemCount + createdCount;
  const atLimit = totalItems >= includedItems;

  const isLast = step === STEPS.length - 1;
  const canContinue = step > 0 || name.trim().length > 0;

  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setError(null);

    const { id, error: saveError } = await createItem(userId, {
      name,
      brand,
      categoryName: category,
      serials,
      images,
      documents,
    });

    savingRef.current = false;
    setPending(false);

    if (!id) {
      setError(saveError ?? "Kunne ikke oprette ejendelen.");
      return;
    }
    if (saveError) {
      // Ejendelen blev oprettet, men en fil fejlede.
      setError(`Ejendelen er gemt, men filerne fejlede: ${saveError}`);
      return;
    }

    // Ikke luk her — kvitteringsskærmen tilbyder at oprette en mere.
    setCreatedCount((n) => n + 1);
    setPhase("done");
  }

  return (
    <>
      {showTrigger && (
        <AddItemTrigger
          itemCount={itemCount}
          includedItems={includedItems}
          extraItemPrice={extraItemPrice}
          canAddItems={canAddItems}
          onOpen={() => dialogRef.current?.showModal()}
        />
      )}

      {trigger && (
        <span onClick={() => dialogRef.current?.showModal()}>{trigger}</span>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="guide-titel"
        className="m-auto w-[min(30rem,calc(100vw-1.5rem))] rounded-sm border-0 bg-transparent p-0 backdrop:bg-[#3d3d3d]/85"
      >
        <div className="max-h-[90dvh] overflow-y-auto rounded-sm bg-white">
          {phase === "done" ? (
            <div className="p-5 text-center sm:p-8">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="size-6" strokeWidth={2.5} />
              </span>

              <h2 className="mt-5 font-display text-[24px] leading-snug font-normal text-navy">
                {showIntro && createdCount === 1
                  ? "Du har registreret din første ejendel"
                  : "Ejendelen er registreret"}
              </h2>
              {atLimit ? (
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-body">
                  Du har nu registreret{" "}
                  <strong className="font-semibold text-navy">
                    {totalItems} af {includedItems}
                  </strong>{" "}
                  inkluderede ejendele. Vil du registrere flere, koster de{" "}
                  <strong className="font-semibold text-navy">
                    {extraItemPrice} kr./md. pr. stk.
                  </strong>{" "}
                  og lægges på din næste faktura.
                </p>
              ) : (
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-body">
                  Vil du registrere flere med det samme?{" "}
                  <span className="text-muted">
                    Du har {includedItems - totalItems} tilbage af dit
                    medlemskab.
                  </span>
                </p>
              )}

              <button
                type="button"
                onClick={again}
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm text-[16px] font-bold transition-colors ${
                  atLimit
                    ? "border border-orange text-orange hover:bg-orange hover:text-white"
                    : "bg-orange text-white hover:bg-orange-dark"
                }`}
              >
                <Plus className="size-4" strokeWidth={2.5} />
                {atLimit ? "Tilkøb ejendel" : "Ja, registrer flere"}
              </button>

              <button
                type="button"
                onClick={finish}
                className="mt-4 text-[14px] text-muted underline underline-offset-4 transition-colors hover:text-navy"
              >
                Nej tak, gå til min side
              </button>
            </div>
          ) : phase === "intro" ? (
            <div className="p-5 text-center sm:p-8">
              <h2
                id="guide-titel"
                className="font-display text-[26px] leading-snug font-normal text-navy"
              >
                Registrér din første ejendel
              </h2>
              <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-body">
                Vi guider dig igennem trin for trin. Det tager to minutter, og
                du kan springe det du ikke har ved hånden over.
              </p>

              <button
                type="button"
                onClick={() => setPhase("steps")}
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark"
              >
                Fortsæt
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={skip}
                className="mt-4 text-[14px] text-muted underline underline-offset-4 transition-colors hover:text-navy"
              >
                Spring over
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
                <p className="text-[13px] text-muted">
                  Trin {step + 1} af {STEPS.length}
                  <span className="ml-2 font-semibold text-navy">
                    {STEPS[step]}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  aria-label="Luk"
                  disabled={pending}
                  className="text-muted transition-colors hover:text-navy"
                >
                  <X className="size-[18px]" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex gap-1 px-6 pt-4">
                {STEPS.map((s, i) => (
                  <span
                    key={s}
                    className={`h-1 flex-1 rounded-full ${
                      i <= step ? "bg-orange" : "bg-line"
                    }`}
                  />
                ))}
              </div>

              <div className="min-h-[15rem] px-5 py-5 sm:px-6 sm:py-6">
                {step === 0 && (
                  <>
                    <h2
                      id="guide-titel"
                      className="font-display text-[22px] font-normal text-navy"
                    >
                      Hvad vil du registrere?
                    </h2>
                    <div className="mt-5">
                      <label htmlFor="w-navn" className={labelClass}>
                        Navn
                      </label>
                      <input
                        id="w-navn"
                        value={name}
                        autoFocus
                        disabled={pending}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={'f.eks. MacBook Pro 14"'}
                        className={`h-11 ${fieldClass}`}
                      />
                    </div>
                    <div className="mt-4">
                      <label htmlFor="w-maerke" className={labelClass}>
                        Mærke <span className="text-muted">(valgfrit)</span>
                      </label>
                      <input
                        id="w-maerke"
                        value={brand}
                        disabled={pending}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="f.eks. Apple"
                        className={`h-11 ${fieldClass}`}
                      />
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 className="font-display text-[22px] font-normal text-navy">
                      Hvilken slags er det?
                    </h2>
                    <p className="mt-1.5 text-[14px] text-body">
                      Vælg fra listen, eller skriv din egen.
                    </p>
                    <div className="mt-4">
                      <CategoryCombobox
                        categories={categories}
                        value={category}
                        onChange={setCategory}
                        disabled={pending}
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="font-display text-[22px] font-normal text-navy">
                      Serienummeret
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-body">
                      Det står som regel på en mærkat i bunden, bag batteriet
                      eller på rammen. Har du det ikke ved hånden, kan du
                      springe over og tilføje det senere.
                    </p>
                    <div className="mt-4 space-y-2">
                      {serials.map((serial, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            value={serial}
                            disabled={pending}
                            aria-label={`Serienummer ${index + 1}`}
                            onChange={(e) =>
                              setSerials((s) =>
                                s.map((v, i) =>
                                  i === index ? e.target.value : v,
                                ),
                              )
                            }
                            placeholder="f.eks. C02GS123MDMQ"
                            className={`mt-0 h-11 font-mono ${fieldClass}`}
                          />
                          {serials.length > 1 && (
                            <button
                              type="button"
                              disabled={pending}
                              aria-label="Fjern serienummer"
                              onClick={() =>
                                setSerials((s) =>
                                  s.filter((_, i) => i !== index),
                                )
                              }
                              className="text-muted hover:text-red-600"
                            >
                              <X className="size-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setSerials((s) => [...s, ""])}
                      className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-orange hover:text-orange-dark"
                    >
                      <Plus className="size-3.5" strokeWidth={2.5} />
                      Tilføj endnu et
                    </button>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2 className="font-display text-[22px] font-normal text-navy">
                      Tag et billede
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-body">
                      Ét af genstanden og ét af mærkaten med serienummeret er
                      nok til at dokumentere den.
                    </p>
                    <div className="mt-4">
                      <FileDropzone
                        id="w-billeder"
                        accept="image/png,image/jpeg,image/webp"
                        maxFiles={6}
                        maxBytes={10 * MB}
                        formats="PNG, JPG og WEBP"
                        label="Træk billeder herind, eller"
                        hint="Maks 6 billeder · 10 MB pr. stk."
                        icon="image"
                        files={images}
                        onChange={setImages}
                        disabled={pending}
                      />
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <h2 className="font-display text-[22px] font-normal text-navy">
                      Kvitteringen
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-body">
                      Et foto af kvitteringen eller garantibeviset er det
                      forsikringen beder om. Den ligger privat og deles aldrig.
                    </p>
                    <div className="mt-4">
                      <FileDropzone
                        id="w-dokumenter"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        maxFiles={4}
                        maxBytes={10 * MB}
                        formats="PNG, JPG, WEBP og PDF"
                        label="Træk kvittering herind, eller"
                        hint="Maks 4 filer · 10 MB pr. stk."
                        icon="document"
                        files={documents}
                        onChange={setDocuments}
                        disabled={pending}
                      />
                    </div>
                  </>
                )}

                {error && (
                  <p role="alert" className="mt-4 text-[14px] text-red-600">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
                {step > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setStep((s) => s - 1)}
                    aria-label="Tilbage"
                    className="-m-2 p-2 text-muted transition-colors hover:text-navy disabled:opacity-50"
                  >
                    <ArrowLeft className="size-4" strokeWidth={2} />
                  </button>
                )}

                <button
                  type="button"
                  disabled={pending || !canContinue}
                  onClick={() => (isLast ? save() : setStep((s) => s + 1))}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:bg-line disabled:text-muted"
                >
                  {pending ? (
                    "Gemmer…"
                  ) : isLast ? (
                    <>
                      <Check className="size-4" strokeWidth={2.5} />
                      Gem ejendel
                    </>
                  ) : (
                    <>
                      Fortsæt
                      <ArrowRight className="size-4" strokeWidth={2.5} />
                    </>
                  )}
                </button>

                {/* Kun trin 1 er obligatorisk — resten kan udfyldes senere. */}
                {step > 0 && !isLast && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setStep((s) => s + 1)}
                    className="text-[14px] text-muted underline underline-offset-4 hover:text-navy"
                  >
                    Spring over
                  </button>
                )}
                {isLast && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={save}
                    className="text-[14px] text-muted underline underline-offset-4 hover:text-navy"
                  >
                    Uden kvittering
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
