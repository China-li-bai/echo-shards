/**
 * Worker static assets cannot include ONNX Runtime wasm files.
 * Cloudflare rejects a single file larger than 25 MiB, and the asyncify
 * wasm is 25.6 MiB. The Next config must emit none of these files and
 * load the matching npm versions from jsDelivr instead.
 * Run: node scripts/assert-worker-asset-policy.mjs
 */
import { readFileSync } from "node:fs";

const errors = [];
function check(condition, message) {
  if (!condition) errors.push(message);
}

const config = readFileSync(new URL("../apps/web/next.config.ts", import.meta.url), "utf8");
check(config.includes("ort-wasm"), "next.config handles ort-wasm files");
check(/emit:\s*false/.test(config), "next.config does not emit ONNX wasm into Worker assets");
check(config.includes("cdn.jsdelivr.net/npm/"), "next.config loads wasm from jsDelivr");
check(config.includes("onnxruntime-web"), "next.config pins onnxruntime-web to its npm package on the CDN");

if (errors.length > 0) {
  console.error(`assert-worker-asset-policy: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("assert-worker-asset-policy: ok");
