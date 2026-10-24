// npm run eval: runs E1 to E7 and writes a scorecard to eval/results/<date>.json.
// Only numbers from these scorecards go in the README or the video.
//
//   EVAL_RUNS=5000 npm run eval     more generated cases per property
//   EVAL_SEED=123 npm run eval      replay a run (the seed is in every scorecard)

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { e1 } from "./e1-baskets";
import { e2 } from "./e2-price-cards";
import { e3 } from "./e3-shelves";
import { e4 } from "./e4-money";
import { e5 } from "./e5-days";
import { e6 } from "./e6-safety";
import { e7 } from "./e7-audit";
import { SETS, type SetName, loadItems, loadTruthSet } from "./lib/truth";
import type { EvalContext, EvalResult } from "./lib/types";

const root = resolve(__dirname, "..");
if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));

function git(command: string): string | null {
  try {
    return execSync(`git ${command}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

async function main() {
  const items = loadItems(root);
  const keys = items.items && new Set(items.items.items.map((i) => i.key));
  const truth = Object.fromEntries(
    (Object.keys(SETS) as SetName[]).map((set) => [set, loadTruthSet(root, set, keys)]),
  ) as EvalContext["truth"];
  const truthErrors = [...items.errors, ...Object.values(truth).flatMap((t) => t.errors)];

  const ctx: EvalContext = {
    root,
    seed: Number(process.env.EVAL_SEED ?? Math.floor(Math.random() * 2 ** 31)),
    runs: Number(process.env.EVAL_RUNS ?? 1000),
    truth,
  };

  const results: EvalResult[] = [];
  for (const e of [e1, e2, e3, e4, e5, e6, e7]) {
    try {
      results.push(await e.run(ctx));
    } catch (error) {
      results.push({ id: e.id, title: e.title, target: e.target, status: "fail", reason: `crashed: ${(error as Error).stack}` });
    }
  }

  const ranAt = new Date();
  const scorecard = {
    date: ranAt.toISOString().slice(0, 10),
    ranAt: ranAt.toISOString(),
    commit: git("rev-parse --short HEAD"),
    uncommittedChanges: git("status --porcelain") !== "",
    node: process.version,
    seed: ctx.seed,
    runsPerProperty: ctx.runs,
    truthFiles: Object.fromEntries(
      Object.values(truth).map((t) => [t.set, { withPhotos: t.entries.length, expected: t.expected, photosWithoutTruth: t.photosWithoutTruth }]),
    ),
    truthErrors,
    summary: {
      pass: results.filter((r) => r.status === "pass").length,
      fail: results.filter((r) => r.status === "fail").length,
      skip: results.filter((r) => r.status === "skip").length,
    },
    results,
  };

  const dir = join(root, "eval/results");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${scorecard.date}.json`);
  writeFileSync(path, JSON.stringify(scorecard, null, 2) + "\n");

  for (const error of truthErrors) console.log(`truth file problem: ${error}`);
  for (const r of results) {
    console.log(`${r.id}  ${r.status.toUpperCase().padEnd(4)}  ${r.title}`);
    if (r.reason) console.log(`      ${r.reason}`);
    for (const need of r.needs ?? []) console.log(`      needs: ${need}`);
    for (const p of r.properties ?? []) {
      console.log(`      ${p.passed ? "ok  " : "FAIL"} ${p.id.padEnd(6)} ${p.runs} cases  ${p.claim}`);
      if (p.error) console.log(`           ${p.error}\n           counterexample: ${p.counterexample}`);
    }
  }
  console.log(`\nScorecard: ${path.replace(root + "/", "")}  (seed ${ctx.seed})`);

  if (scorecard.summary.fail > 0 || truthErrors.length > 0) process.exitCode = 1;
}

main();
