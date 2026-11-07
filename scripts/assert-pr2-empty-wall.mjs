/**
 * PR2: empty form-shard wall must expose pathway copy + CTA, not poetic-only empty state.
 * Scans apps/web source for required / forbidden empty-state strings.
 * Run: node --import tsx scripts/assert-pr2-empty-wall.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const wallPath = join(
  new URL("../apps/web/src/components", import.meta.url).pathname,
  "form-shard-wall.tsx",
);
const pagePath = join(new URL("../apps/web/src/app", import.meta.url).pathname, "page.tsx");
const stepsPath = join(
  new URL("../apps/web/src/components", import.meta.url).pathname,
  "camp-today-steps.tsx",
);
const wall = readFileSync(wallPath, "utf8");
const page = readFileSync(pagePath, "utf8");
const stepsSrc = readFileSync(stepsPath, "utf8");

const requiredWall = ["先去练意思", "练过意思并隔夜后，痕迹会出现在这里"];
const forbiddenWallOnly = ["练完潮汐，墙面会留下痕迹"]; // poetic-only cold invite replaced
const requiredCampPrimary = ["开始今天的练习"];

const errors = [];

for (const s of requiredWall) {
  if (!wall.includes(s)) errors.push(`form-shard-wall.tsx missing required: 「${s}」`);
}
for (const s of forbiddenWallOnly) {
  if (wall.includes(s)) errors.push(`form-shard-wall.tsx still has replaced cold invite: 「${s}」`);
}
if (!wall.includes('variant="outline"') && !wall.includes("variant='outline'")) {
  errors.push("empty-wall CTA should use outline/secondary (variant=outline)");
}
for (const s of requiredCampPrimary) {
  if (!page.includes("CampPracticeCta") && !page.includes(s)) {
    errors.push(`camp page missing primary CTA wiring for 「${s}」`);
  }
}
// Camp page should still mount CampPracticeCta (solid primary lives there)
if (!page.includes("CampPracticeCta")) {
  errors.push("page.tsx must keep CampPracticeCta as the solid primary CTA host");
}
// Steps strip should be demoted (aria label from PR2; may live in CampTodaySteps after PR7)
if (!page.includes("今日步骤（次要）") && !stepsSrc.includes("今日步骤（次要）")) {
  errors.push("camp steps strip should be labeled as secondary (PR2 hierarchy)");
}

if (errors.length) {
  console.error("PR2 assert failed:");
  for (const e of errors) console.error(" ", e);
  process.exit(1);
}

console.log("assert-pr2-empty-wall: ok (pathway empty wall + demoted camp steps)");
