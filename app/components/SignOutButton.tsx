"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

const VARIANTS = {
  navbar:
    "rounded-sm border border-white/35 px-5 py-1.5 text-[15px] transition-colors hover:border-white hover:bg-white/10",
  page: "h-11 rounded-sm border border-white/35 px-6 text-[16px] font-medium transition-colors hover:border-white hover:bg-white/10",
} as const;

export function SignOutButton({
  variant = "page",
}: {
  variant?: keyof typeof VARIANTS;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      // Begge varianter sidder på navy baggrund, derfor hvid tekst.
      className={`inline-flex items-center gap-2 text-white disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      <LogOut className="size-4" strokeWidth={1.75} />
      {pending ? "Logger ud…" : "Log ud"}
    </button>
  );
}
