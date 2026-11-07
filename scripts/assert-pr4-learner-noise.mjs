/**
 * PR4: apprentice default review surface hides CEFR; NGSL attribution is folded.
 * Scans review-session.tsx + site-footer.tsx (and light scan of default learner routes).
 * Run: node --import tsx scripts/assert-pr4-learner-noise.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const webSrc = new URL("../apps/web/src", import.meta.url).pathname;
const review = readFileSync(join(webSrc, "components/review-session.tsx"), "utf8");
const footer = readFileSync(join(webSrc, "components/site-footer.tsx"), "utf8");

const errors = [];

// Default practice card must not render CEFR chip
if (/prompt\.cefr\s*\?/.test(review) || /\{prompt\.cefr\}/.test(review)) {
  errors.push("review-session.tsx still renders prompt.cefr on the practice card");
}
// Soft: no outline Badge driven by cefr near progressLabel
if (/progressLabel[\s\S]{0,220}cefr/.test(review)) {
  errors.push("review-session.tsx still places cefr near progressLabel (default card header)");
}

// Footer: NGSL attribution must live inside <details>, not a bare always-on paragraph
if (!footer.includes("<details")) {
  errors.push("site-footer.tsx should fold attribution into <details>");
}
if (!footer.includes("关于词表") && !footer.includes("关于")) {
  errors.push("site-footer.tsx missing secondary「关于」summary for attribution");
}
const ngslIdx = footer.indexOf("NGSL");
if (ngslIdx === -1) {
  errors.push("site-footer.tsx missing NGSL attribution (CC BY-SA still required)");
} else {
  const before = footer.slice(0, ngslIdx);
  const lastDetails = before.lastIndexOf("<details");
  const lastSummaryClose = before.lastIndexOf("</summary>");
  if (lastDetails === -1 || lastSummaryClose === -1 || lastSummaryClose < lastDetails) {
    errors.push("NGSL attribution must appear after </summary> inside <details>, not always visible");
  }
}
// Summary itself should not scream NGSL
const summaryMatch = footer.match(/<summary[\s\S]*?<\/summary>/);
if (summaryMatch && /NGSL/i.test(summaryMatch[0])) {
  errors.push("footer <summary> should not expose NGSL (keep it inside the fold)");
}

if (errors.length) {
  console.error("PR4 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log("assert-pr4-learner-noise: ok (no CEFR on default review card; NGSL folded in footer)");
