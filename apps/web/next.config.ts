import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate production build from next dev's .next so `npm run check`/`build`
  // cannot wipe hashed chunks the running dev server still serves (hydration 404).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@echo-shards/core"],
  webpack: (config) => {
    // packages/core is NodeNext and imports "./file.js" which is the .ts source.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    // Bundle quest YAML as UTF-8 source strings for Workers.
    config.module.rules.push({
      test: /\.ya?ml$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
