import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

import { AudienceSwitch } from "./AudienceSwitch";
import { MobileMenu } from "./MobileMenu";
import { NavSearch } from "./NavSearch";
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
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6 md:gap-8">
          <div className="flex items-center gap-3">
            {/* Logoet har selv en cirkel og en ring, så den tidligere
                indpakning tegnede en ring uden om en ring. Størrelsen sættes
                med className; width/height er dobbelt op, så mærket også er
                skarpt på skærme med høj pixeltæthed. */}
            <Image
              src="/images/logo-ejendel.png"
              alt="Ejendelsregisteret"
              width={88}
              height={88}
              className="size-11 shrink-0"
            />
            <span className="leading-none">
              <span className="block font-display text-[19px] font-bold tracking-tight">
                Ejendelsregisteret
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-orange">
                Dækker alt &ndash; over alt
              </span>
            </span>
          </div>

          <AudienceSwitch />

          <div className="ml-auto flex items-center gap-5">
            {/* Søgefeltet og login-knapperne fylder for meget på en telefon
                og flytter i stedet ind i skuffen. */}
            <div className="hidden items-center gap-5 md:flex">
              <NavSearch />
              <AuthMenu initialSignedIn={signedIn} />
            </div>
            <MobileMenu signedIn={signedIn} />
          </div>
        </div>
      </div>

      {/* Sektionsbjælke */}
      <div className="hidden bg-plum text-white md:block">
        <div className="mx-auto max-w-6xl px-6">
          <SectionNav />
        </div>
      </div>
    </header>
  );
}
