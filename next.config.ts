import path from "node:path";
import type { NextConfig } from "next";

import { LEGACY_REDIRECTS } from "./lib/redirects";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Adresserne fra WordPress-sitet. Se lib/redirects.ts for hvorfor de
  // peger hvor de gør.
  async redirects() {
    return LEGACY_REDIRECTS;
  },

  images: {
    // next/image afviser fjerne værter der ikke står her. Værten udledes af
    // env-variablen frem for at være hardkodet, så et projektskifte ikke
    // kræver en kodeændring.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // Lås workspace-rooten til projektmappen, så en package-lock.json
  // uden for repoet ikke bliver valgt som root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
