import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type DaySale, MIN_SHELF_CONFIDENCE, paidQuantities, reconcileDay } from "../src/lib/reconcile";
import type { CatalogueItem } from "../src/lib/orders";
import { notBuiltYet } from "./lib/needs";
import type { Eval } from "./lib/types";

// E5. Reconciliation days: twenty simulated days with known truth, written by
// eval/lib/make-days.ts from what each customer really did (honest buyers, a
// walker, an underpayment, an overpayment, a restock, a refund, a webhook that
// has not arrived, a denied capture, an abandoned checkout, an unsure shelf
// count). The day's orders and shelf counts go through the same code as the
// dusk report (paidQuantities, reconcileDay), and every item must come out
// exactly as the truth says. Above all, nobody is accused wrongly: an item is
// only reported unaccounted for when that many really walked, and a payment
// PayPal has not confirmed yet makes the item "uncertain", never "missing".
// So does a refund claim the grower has not decided (added 9 Nov, after the
// dry run): if granting it would leave goods unpaid for, the item is
// "uncertain", never "all paid". The explanation's numbers are checked by E4.5.
//
// Beside it, for comparison only (added 8 Nov), a naive tally of the same
// days: the same sums (taken = morning + restocks - dusk, missing = taken -
// paid), but only payments PayPal has already confirmed count as paid, and
// every shelf count is taken at its word, with no "uncertain". It is judged by
// the same rule as Strawbank's report: reporting more unaccounted for than
// really walked is a wrong accusation. The comparison never decides pass or fail.

type Counts = Record<string, number>;
type DayFile = {
  date: string;
  scenario: string[];
  catalogue: CatalogueItem[];
  morning: Counts;
  restocks: Counts[];
  customers: { took: Counts; declared: Counts; payment: DaySale["payment"]; returned?: Counts; claimed?: Counts; note: string }[];
  dusk: Counts;
  duskConfidence: Counts;
  expected: Record<string, { taken: number; paid: number; pending: number; claimed: number; netWalked: number; gapMinor: number }>;
};

export const e5: Eval = {
  id: "E5",
  title: "Reconciliation days",
  target: "20 of 20 days with taken, paid and gap exactly right; nobody wrongly accused",
  async run(ctx) {
    const dir = join(ctx.root, "eval/truth/days");
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
    if (files.length < 20) return notBuiltYet(this, [`20 simulated days in eval/truth/days/ (found ${files.length}); run npx tsx eval/lib/make-days.ts`]);

    const cases: object[] = [];
    let exactDays = 0;
    let items = 0;
    let wrongAccusations = 0;
    let walksCaught = 0;
    let walks = 0;
    let naiveWrongAccusations = 0;
    let naiveWrongDays = 0;
    let naiveWronglyAccusedMinor = 0;
    let openClaims = 0;
    let openClaimsFlagged = 0;
    for (const file of files) {
      const day = JSON.parse(readFileSync(join(dir, file), "utf8")) as DayFile;
      // What the app holds: one order per customer who reached checkout, with PayPal's word on it.
      const sales: DaySale[] = day.customers
        .filter((c) => Object.keys(c.declared).length > 0)
        .map((c) => ({
          lines: Object.entries(c.declared).map(([key, quantity]) => ({ key, quantity })),
          payment: c.payment,
          returned: c.returned,
          claimed: c.claimed,
        }));
      const { paid, pending, claimed } = paidQuantities(sales);
      const report = reconcileDay(day.catalogue, {
        morning: day.morning,
        restocks: day.restocks,
        dusk: day.dusk,
        duskConfidence: day.duskConfidence,
        paid,
        pending,
        claimed,
      });

      const problems: string[] = [];
      for (const row of report) {
        items++;
        const truth = day.expected[row.key];
        const sure = (day.duskConfidence[row.key] ?? 0) >= MIN_SHELF_CONFIDENCE;
        if (row.taken !== truth.taken) problems.push(`${row.key}: taken ${row.taken}, truth ${truth.taken}`);
        if (row.paid !== truth.paid) problems.push(`${row.key}: paid ${row.paid}, truth ${truth.paid}`);
        if (row.gapMinor !== truth.gapMinor) problems.push(`${row.key}: gap worth ${row.gapMinor}, truth ${truth.gapMinor}`);
        if (!sure && !row.uncertain) problems.push(`${row.key}: unsure shelf count not marked uncertain`);
        if (truth.pending > 0 && row.gap > 0 && !row.uncertain) problems.push(`${row.key}: unconfirmed payment reported as missing`);
        if (row.claimed !== truth.claimed) problems.push(`${row.key}: ${row.claimed} under an open refund claim, truth ${truth.claimed}`);
        if (truth.claimed > 0 && row.taken > row.paid - truth.claimed && !row.uncertain) {
          problems.push(`${row.key}: an open refund claim could mean goods walked, but the item is not marked uncertain`);
        }
        // An accusation must be true: never more unaccounted for than really walked.
        if (!row.uncertain && row.gap > 0 && row.gap > truth.netWalked) {
          wrongAccusations++;
          problems.push(`${row.key}: reported ${row.gap} unaccounted for, ${truth.netWalked} really walked`);
        }
        if (truth.claimed > 0 && row.taken > row.paid - truth.claimed) {
          openClaims++;
          if (row.uncertain) openClaimsFlagged++;
        }
        if (sure && truth.pending === 0 && truth.netWalked > 0) {
          walks++;
          if (!row.uncertain && row.gap === truth.netWalked) walksCaught++;
          else problems.push(`${row.key}: ${truth.netWalked} walked, reported gap ${row.gap}${row.uncertain ? " (uncertain)" : ""}`);
        }
      }
      if (problems.length === 0) exactDays++;

      // The naive tally: confirmed payments only, every shelf count believed.
      const naive: string[] = [];
      for (const row of report) {
        const truth = day.expected[row.key];
        const naiveGap = row.taken - (paid[row.key] ?? 0);
        const walked = Math.max(0, truth.netWalked);
        if (naiveGap > 0 && naiveGap > walked) {
          naiveWrongAccusations++;
          naiveWronglyAccusedMinor += (naiveGap - walked) * row.unitMinor;
          naive.push(`${row.key}: would report ${naiveGap} unaccounted for, ${walked} really walked`);
        }
      }
      if (naive.length > 0) naiveWrongDays++;
      cases.push({ day: day.date, scenario: day.scenario, ok: problems.length === 0, problems, ...(naive.length > 0 && { naiveTally: naive }) });
    }

    const passed = exactDays === files.length && files.length >= 20 && wrongAccusations === 0;
    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: passed ? "pass" : "fail",
      ...(!passed && { reason: `${exactDays} of ${files.length} days exactly right; ${wrongAccusations} wrong accusation(s)` }),
      metrics: { days: files.length, exactDays, items, wrongAccusations, walks, walksCaught, naiveWrongAccusations, naiveWrongDays, naiveWronglyAccusedMinor, openClaims, openClaimsFlagged },
      cases,
    };
  },
};
