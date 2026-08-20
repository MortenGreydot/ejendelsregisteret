import { Layers, Search } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { AudienceSwitch } from "./AudienceSwitch";
import { AuthMenu } from "./AuthMenu";
import { SectionNav } from "./SectionNav";

export async function Navbar() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  return (
    <header>
      {/* Øverste bjælke */}
      <div className="bg-navy text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
          <a href="#" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/25">
              <Layers className="size-4.5 text-orange" strokeWidth={1.75} />
            </span>
            <span className="leading-none">
              <span className="block font-display text-[17px] font-bold tracking-tight">
                Ejendelsregisteret
              </span>
              <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.18em] text-orange">
                Dækker alt &ndash; over alt
              </span>
            </span>
          </a>

          <AudienceSwitch />

          <div className="ml-auto flex items-center gap-5">
            <button
              type="button"
              aria-label="Søg"
              className="text-white/80 transition-colors hover:text-white"
            >
              <Search className="size-[18px]" strokeWidth={1.75} />
            </button>
            <AuthMenu initialSignedIn={signedIn} />
          </div>
        </div>
      </div>

      {/* Sektionsbjælke */}
      <div className="bg-plum text-white">
        <div className="mx-auto max-w-6xl px-6">
          <SectionNav />
        </div>
      </div>
    </header>
  );
}
