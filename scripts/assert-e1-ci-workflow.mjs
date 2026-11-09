/**
 * E1 contract: .github/workflows/check.yml must run the existing npm run check
 * on pull requests and on main, with a lockfile install, Node 22, read-only
 * token, and cancel-in-progress. Negative fixtures stay red if that contract
 * is weakened.
 *
 * This does not execute GitHub Actions. A green local run only proves the
 * file matches the contract. The remote run is the execution proof.
 *
 * Run: node scripts/assert-e1-ci-workflow.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const root = new URL("..", import.meta.url).pathname;
const workflowPath = join(root, ".github/workflows/check.yml");

function asMap(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function triggersOf(doc) {
  return asMap(doc?.on) ?? asMap(doc?.[true]);
}

/** @returns {string[]} */
export function workflowViolations(doc, raw) {
  const errors = [];
  const text = typeof raw === "string" ? raw : "";
  if (/\bsecrets\./.test(text)) errors.push("must not reference secrets.*");
  if (/pull_request_target/.test(text)) errors.push("pull_request_target is not allowed");

  const on = triggersOf(doc);
  if (!on) {
    errors.push("missing on:");
  } else {
    if (!Object.prototype.hasOwnProperty.call(on, "pull_request")) {
      errors.push("must trigger on pull_request");
    }
    const push = asMap(on.push);
    const branches = push && Array.isArray(push.branches) ? push.branches.map(String) : [];
    if (!branches.includes("main")) errors.push("push.branches must include main");
    if (branches.some((branch) => branch === "*" || branch === "**")) {
      errors.push("push.branches must not be a wildcard");
    }
  }

  const permissions = asMap(doc?.permissions);
  const permissionKeys = permissions ? Object.keys(permissions) : [];
  if (!permissions || permissions.contents !== "read" || permissionKeys.length !== 1) {
    errors.push("workflow permissions must be exactly { contents: read }");
  }

  const concurrency = asMap(doc?.concurrency);
  if (!concurrency || concurrency["cancel-in-progress"] !== true) {
    errors.push("concurrency.cancel-in-progress must be true");
  } else if (typeof concurrency.group !== "string" || !/github\.(ref|event\.pull_request\.number)/.test(concurrency.group)) {
    errors.push("concurrency.group must key off github.ref or the pull request number");
  }

  const jobs = asMap(doc?.jobs);
  const jobNames = jobs ? Object.keys(jobs) : [];
  if (jobNames.length !== 1) {
    errors.push("exactly one job");
  }
  const job = jobs ? asMap(jobs[jobNames[0]]) : null;
  if (!job) return errors;
  if (job.permissions) errors.push("job must not override workflow permissions");
  if (job.environment) errors.push("job must not bind an environment");
  const timeout = job["timeout-minutes"];
  if (typeof timeout !== "number" || timeout < 10 || timeout > 30) {
    errors.push("timeout-minutes must be a number from 10 through 30");
  }

  const steps = Array.isArray(job.steps) ? job.steps : [];
  const runs = [];
  let checkoutOk = false;
  let nodeOk = false;
  for (const step of steps) {
    const row = asMap(step);
    if (!row) {
      errors.push("each step must be a map");
      continue;
    }
    if (typeof row.uses === "string") {
      if (row.uses.startsWith("actions/checkout@")) {
        if (row.uses !== "actions/checkout@v4") errors.push("checkout must be actions/checkout@v4");
        const withMap = asMap(row.with);
        if (!withMap || withMap["persist-credentials"] !== false) {
          errors.push("checkout persist-credentials must be false");
        }
        checkoutOk = true;
      } else if (row.uses.startsWith("actions/setup-node@")) {
        if (row.uses !== "actions/setup-node@v4") errors.push("setup-node must be actions/setup-node@v4");
        const withMap = asMap(row.with);
        const version = withMap ? String(withMap["node-version"]) : "";
        if (version !== "22" && version !== "22.x") errors.push(`node-version must be 22, got ${version || "(missing)"}`);
        if (!withMap || withMap.cache !== "npm") errors.push("setup-node cache must be npm so install follows the lockfile");
        nodeOk = true;
      } else {
        errors.push(`unexpected action ${row.uses}`);
      }
    }
    if (typeof row.run === "string") {
      const command = row.run.trim();
      runs.push(command);
      if (/\bnpm\s+install\b/.test(command)) errors.push("use npm ci, not npm install");
      if (/\bnpm\s+run\s+deploy\b|\bwrangler\b|\bsupabase\b|\bopennextjs-cloudflare\b/i.test(command)) {
        errors.push(`deploy-like command is not allowed: ${command}`);
      }
    }
  }
  if (!checkoutOk) errors.push("missing actions/checkout@v4");
  if (!nodeOk) errors.push("missing actions/setup-node@v4 with Node 22");
  if (!runs.includes("npm ci")) errors.push("missing a step that runs exactly npm ci");
  if (!runs.includes("npm run check")) errors.push("missing a step that runs exactly npm run check");
  return errors;
}

const GOOD = [
  "name: check",
  "on:",
  "  pull_request:",
  "  push:",
  "    branches: [main]",
  "permissions:",
  "  contents: read",
  "concurrency:",
  "  group: check-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
  "  cancel-in-progress: true",
  "jobs:",
  "  check:",
  "    runs-on: ubuntu-latest",
  "    timeout-minutes: 20",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "        with:",
  "          persist-credentials: false",
  "      - uses: actions/setup-node@v4",
  "        with:",
  "          node-version: 22",
  "          cache: npm",
  "      - run: npm ci",
  "      - run: npm run check",
  "",
].join("\n");

function without(mutate) {
  const doc = parse(GOOD);
  mutate(doc);
  return doc;
}

/** Cases the contract must reject. Each entry is a full workflow document. */
export const negativeCases = [
  {
    name: "no pull_request",
    doc: without((doc) => {
      delete doc.on.pull_request;
    }),
    raw: GOOD,
  },
  {
    name: "push is not limited to main",
    doc: without((doc) => {
      doc.on.push.branches = ["*"];
    }),
    raw: GOOD,
  },
  {
    name: "contents write",
    doc: without((doc) => {
      doc.permissions.contents = "write";
    }),
    raw: GOOD,
  },
  {
    name: "npm install instead of npm ci",
    doc: without((doc) => {
      doc.jobs.check.steps = doc.jobs.check.steps.map((step) =>
        step.run === "npm ci" ? { run: "npm install" } : step,
      );
    }),
    raw: GOOD,
  },
  {
    name: "deploy step",
    doc: without((doc) => {
      doc.jobs.check.steps.push({ run: "npm run deploy" });
    }),
    raw: GOOD,
  },
  {
    name: "secrets reference",
    doc: parse(GOOD),
    raw: `${GOOD}\n# echo \${{ secrets.CLOUDFLARE_API_TOKEN }}\n`,
  },
  {
    name: "node 18",
    doc: without((doc) => {
      const setup = doc.jobs.check.steps.find((step) => String(step.uses || "").includes("setup-node"));
      setup.with["node-version"] = 18;
    }),
    raw: GOOD,
  },
  {
    name: "does not cancel old runs",
    doc: without((doc) => {
      doc.concurrency["cancel-in-progress"] = false;
    }),
    raw: GOOD,
  },
  {
    name: "skips npm run check",
    doc: without((doc) => {
      doc.jobs.check.steps = doc.jobs.check.steps.filter((step) => step.run !== "npm run check");
    }),
    raw: GOOD,
  },
  {
    name: "pull_request_target",
    doc: parse(GOOD.replace("pull_request:", "pull_request_target:")),
    raw: GOOD.replace("pull_request:", "pull_request_target:"),
  },
];

function checkScriptViolations(pkg) {
  const errors = [];
  const check = pkg?.scripts?.check;
  const required = ["npm test", "npm run assert", "npm run typecheck", "npm run build", "npm run enrichment:validate"];
  if (typeof check !== "string") {
    errors.push("package.json scripts.check missing");
    return errors;
  }
  let cursor = 0;
  for (const part of required) {
    const at = check.indexOf(part, cursor);
    if (at < 0) errors.push(`scripts.check dropped or reordered ${part}`);
    else cursor = at + part.length;
  }
  const engines = String(pkg?.engines?.node ?? "");
  if (!engines.includes(">=22")) errors.push(`engines.node must require >=22, got ${engines || "(missing)"}`);
  return errors;
}

const failures = [];

const goodErrors = workflowViolations(parse(GOOD), GOOD);
if (goodErrors.length > 0) {
  failures.push(`built-in good fixture was rejected: ${goodErrors.join("; ")}`);
}

for (const testCase of negativeCases) {
  const errors = workflowViolations(testCase.doc, testCase.raw);
  if (errors.length === 0) failures.push(`negative case accepted: ${testCase.name}`);
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const error of checkScriptViolations(pkg)) failures.push(error);

if (!existsSync(workflowPath)) {
  failures.push(`missing ${workflowPath}`);
} else {
  const raw = readFileSync(workflowPath, "utf8");
  let doc;
  try {
    doc = parse(raw);
  } catch (error) {
    failures.push(`workflow YAML parse failed: ${error instanceof Error ? error.message : String(error)}`);
    doc = null;
  }
  if (doc) {
    for (const error of workflowViolations(doc, raw)) failures.push(`check.yml: ${error}`);
  }
}

if (failures.length > 0) {
  console.error(`assert-e1-ci-workflow: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`assert-e1-ci-workflow: ok (${negativeCases.length} negative cases rejected, check.yml + scripts.check accepted)`);
