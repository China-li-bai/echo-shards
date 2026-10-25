import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
