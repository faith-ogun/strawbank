import fc from "fast-check";
import type { Eval, PropertyResult } from "../lib/types";
import { p1 } from "./p1-order-totals";
import { p2 } from "./p2-refund-cap";
import { p3 } from "./p3-refund-once";
import { p4 } from "./p4-webhooks";
import { p5 } from "./p5-explanation-numbers";
import { p6 } from "./p6-tool-allowlist";

const PROPERTIES = [...p1, ...p2, ...p3, ...p4, ...p5, ...p6];

// E4. Money invariants: generated cases, no photos and no PayPal. Any failure
// blocks a release.
export const e4: Eval = {
  id: "E4",
  title: "Money invariants",
  target: "100% of generated cases pass",
  async run(ctx) {
    const properties: PropertyResult[] = [];
    for (const [i, p] of PROPERTIES.entries()) {
      const seed = ctx.seed + i;
      let details: Awaited<ReturnType<typeof p.check>>;
      try {
        details = await p.check({ numRuns: p.runs ?? ctx.runs, seed });
      } catch (error) {
        properties.push({ id: p.id, claim: p.claim, runs: 0, passed: false, seed, error: `crashed: ${(error as Error).stack}` });
        continue;
      }
      properties.push({
        id: p.id,
        claim: p.claim,
        runs: details.numRuns,
        passed: !details.failed,
        seed: details.seed,
        ...(details.failed && {
          counterexample: fc.stringify(details.counterexample).slice(0, 2000),
          error: String(details.errorInstance).slice(0, 2000),
        }),
      });
    }
    const failed = properties.filter((p) => !p.passed).length;
    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: failed > 0 ? "fail" : "pass",
      ...(failed > 0 && { reason: `${failed} of ${properties.length} properties failed` }),
      metrics: { properties: properties.length, cases: properties.reduce((s, p) => s + p.runs, 0), failed },
      properties,
    };
  },
};
