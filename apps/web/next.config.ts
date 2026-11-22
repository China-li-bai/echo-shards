import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const webAppDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webAppDir, "../..");

function packageVersion(packageDir: string): string {
  return JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8")).version as string;
}

function onnxWasmCdnRule(packageDir: string, npmName: string) {
  const version = packageVersion(packageDir);
  return {
    test: /ort-wasm-simd-threaded.*\.wasm$/,
    include: packageDir,
    type: "asset/resource" as const,
    generator: {
      emit: false,
      publicPath: `https://cdn.jsdelivr.net/npm/${npmName}@${version}/dist/`,
      filename: "[name][ext]",
    },
  };
}

const hoistedOnnxWeb = path.join(repoRoot, "node_modules/onnxruntime-web");
const kokoroOnnxWeb = path.join(repoRoot, "node_modules/kokoro-js/node_modules/onnxruntime-web");
const kokoroTransformers = path.join(
  repoRoot,
  "node_modules/kokoro-js/node_modules/@huggingface/transformers",
);

const nextConfig: NextConfig = {
  // Isolate production build from next dev's .next so `npm run check`/`build`
  // cannot wipe hashed chunks the running dev server still serves (hydration 404).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@echo-shards/core"],
  webpack: (config) => {
    // packages/core is NodeNext and imports "./file.js" which is the .ts source.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "onnxruntime-node$": false,
      "sharp$": false,
    };
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
    // Cloudflare Workers rejects a single static asset larger than 25 MiB.
    // ONNX Runtime's asyncify wasm is 25.6 MiB, so these files are not emitted
    // into the Worker bundle; the browser loads the same npm versions from jsDelivr.
    const wasmRules = [
      existsSync(hoistedOnnxWeb) ? onnxWasmCdnRule(hoistedOnnxWeb, "onnxruntime-web") : null,
      existsSync(kokoroOnnxWeb) ? onnxWasmCdnRule(kokoroOnnxWeb, "onnxruntime-web") : null,
      existsSync(kokoroTransformers)
        ? onnxWasmCdnRule(kokoroTransformers, "@huggingface/transformers")
        : null,
    ].filter(Boolean);
    config.module.rules.push(...wasmRules);
    return config;
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
