import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { geminiNeeds, notBuiltYet } from "./lib/needs";
import type { Eval } from "./lib/types";

// E5. Reconciliation days: twenty simulated days with known truth (stock,
// takings, payments, an underpayment, a restock, a refund, a missed webhook).
// The numbers are code and must be exact; the explanation is checked by E4.5.
export const e5: Eval = {
  id: "E5",
  title: "Reconciliation days",
  target: "20 of 20 days with taken, paid and gap exactly right",
  async run(ctx) {
    const dir = join(ctx.root, "eval/truth/days");
    const found = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).length : 0;
    const needs = found < 20 ? [`20 simulated days in eval/truth/days/ (found ${found}; the day format is defined with E5)`] : [];
    return notBuiltYet(this, [...needs, ...geminiNeeds().map((n) => `${n} (for the explanation half)`)]);
  },
};
