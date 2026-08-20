"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { AuthDialog } from "./AuthDialog";

export function AuthMenu({ initialSignedIn }: { initialSignedIn: boolean }) {
  const [signedIn, setSignedIn] = useState(initialSignedIn);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!signedIn) {
    return <AuthDialog />;
  }

  return (
    <Link
      href="/min-side"
      className="inline-flex items-center gap-2 rounded-sm border border-white/35 px-3.5 py-1.5 text-[13px] transition-colors hover:border-white hover:bg-white/10"
    >
      <UserRound className="size-4" strokeWidth={1.75} />
      Min side
    </Link>
  );
}
