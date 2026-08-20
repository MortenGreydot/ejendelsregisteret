import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lås workspace-rooten til projektmappen, så en package-lock.json
  // uden for repoet ikke bliver valgt som root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
