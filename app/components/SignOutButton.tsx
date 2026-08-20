"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
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
      className="inline-flex h-11 items-center gap-2 rounded-sm border border-line px-5 text-[14px] font-medium text-navy transition-colors hover:border-navy disabled:opacity-60"
    >
      <LogOut className="size-4" strokeWidth={1.75} />
      {pending ? "Logger ud…" : "Log ud"}
    </button>
  );
}
