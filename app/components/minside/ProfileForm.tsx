"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { userMessage } from "@/lib/errors";

const fieldClass =
  "mt-2 h-11 w-full rounded-sm border border-line bg-white px-5 text-[15px] text-navy placeholder:text-muted focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange disabled:opacity-60";

const labelClass = "block text-[14px] font-semibold text-navy";

export function ProfileForm({
  userId,
  email,
  fullName,
  phone,
}: {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();

    // Skrives direkte til profiles, ikke gennem auth-metadata. Metadata er
    // brugerredigerbart og bør kun være udgangspunktet ved oprettelsen.
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: String(form.get("navn") ?? "").trim() || null,
        phone: String(form.get("telefon") ?? "").trim() || null,
      })
      .eq("user_id", userId);

    setPending(false);
    if (updateError) {
      setError(
        userMessage(updateError, "Dine oplysninger kunne ikke gemmes.", {
          "42501": "Du kan kun ændre din egen profil.",
        }),
      );
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-sm border border-line bg-white p-6"
    >
      <h2 className="font-display text-[20px] font-bold text-navy">
        Profiloplysninger
      </h2>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="profil-navn" className={labelClass}>
            Fulde navn
          </label>
          <input
            id="profil-navn"
            name="navn"
            type="text"
            autoComplete="name"
            disabled={pending}
            defaultValue={fullName ?? ""}
            placeholder="Hans Hansen"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="profil-email" className={labelClass}>
            E-mail
          </label>
          <input
            id="profil-email"
            type="email"
            value={email}
            readOnly
            disabled
            title="E-mail ændres via din konto, ikke her"
            className={`${fieldClass} bg-mist`}
          />
        </div>

        <div>
          <label htmlFor="profil-telefon" className={labelClass}>
            Telefon
          </label>
          <input
            id="profil-telefon"
            name="telefon"
            type="tel"
            autoComplete="tel"
            disabled={pending}
            defaultValue={phone ?? ""}
            placeholder="+45 00 00 00 00"
            className={fieldClass}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-[14px] text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-4 text-[14px] text-emerald-700">
          Ændringerne er gemt.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 h-11 w-full rounded-sm bg-orange text-[16px] font-bold text-white transition-colors hover:bg-orange-dark disabled:opacity-70"
      >
        {pending ? "Gemmer…" : "Gem ændringer"}
      </button>
    </form>
  );
}
