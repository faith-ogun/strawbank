// Writes the twenty simulated days for eval E5 to eval/truth/days/. Run once:
//   npx tsx eval/lib/make-days.ts
// Each day is built from what every customer really did (took, declared,
// whether PayPal confirmed the payment, what was refunded), and the expected
// numbers are worked out from those customers, not from src/lib/reconcile.ts,
// so E5 checks the dusk report against an independent truth. The seed is fixed:
// running it again writes the same files.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Counts = Record<string, number>;
type Customer = {
  /** What they physically took from the stand. */
  took: Counts;
  /** What they paid for at checkout. Empty when they left without paying. */
  declared: Counts;
  payment: "confirmed" | "pending" | "unpaid";
  /** Quantities refunded through Strawbank because they were charged for more than they took. */
  returned?: Counts;
  /** Quantities in a refund claim the grower has not decided yet (added 9 Nov). */
  claimed?: Counts;
  note: string;
};

const CATALOGUE = [
  { key: "egg", name: "Eggs", unitMinor: 60 },
  { key: "onion", name: "Onions", unitMinor: 30 },
  { key: "potato", name: "Potatoes", unitMinor: 20 },
  { key: "jam", name: "Jam", unitMinor: 450 },
];
const KEYS = CATALOGUE.map((i) => i.key);

let seed = 20261103;
function random(): number {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

function basket(stock: Counts): Counts {
  const out: Counts = {};
  for (const key of KEYS) {
    if (random() < 0.45) {
      const want = key === "jam" ? between(1, 2) : between(1, 6);
      const n = Math.min(want, stock[key]);
      if (n > 0) out[key] = n;
    }
  }
  return out;
}

const take = (stock: Counts, took: Counts) => {
  for (const [k, n] of Object.entries(took)) stock[k] -= n;
};

// What each day must contain, so that every case appears at least once.
const SCENARIOS: string[][] = [
  [],
  ["walker"],
  ["underpay"],
  ["restock"],
  ["refund"],
  ["pending"],
  ["denied"],
  ["unsure"],
  ["abandoned"],
  ["walker", "restock"],
  ["underpay", "refund"],
  ["pending", "walker"],
  ["overpay", "claim"],
  ["refund", "pending"],
  ["denied", "restock"],
  ["unsure", "walker"],
  ["claim-walked"],
  ["walker", "walker"],
  ["restock", "refund", "pending"],
  ["underpay", "denied", "unsure"],
];

function makeDay(index: number, scenario: string[]) {
  const morning: Counts = { egg: between(18, 36), onion: between(10, 30), potato: between(20, 40), jam: between(4, 12) };
  const stock = { ...morning };
  const restocks: Counts[] = [];
  const customers: Customer[] = [];

  const honest = (note: string) => {
    const took = basket(stock);
    if (Object.keys(took).length === 0) return;
    take(stock, took);
    customers.push({ took, declared: { ...took }, payment: "confirmed", note });
  };

  for (let i = between(4, 9); i > 0; i--) honest("paid in full");

  for (const event of scenario) {
    if (event === "restock") {
      const added = { egg: between(6, 12), jam: between(2, 4) };
      restocks.push(added);
      for (const [k, n] of Object.entries(added)) stock[k] += n;
      for (let i = between(1, 3); i > 0; i--) honest("paid in full, after the restock");
      continue;
    }
    if (event === "unsure") {
      honest("paid in full");
      continue;
    }
    // An open refund claim (added 9 Nov, after the dry run): fixed quantities and
    // no random numbers, so every other day's file stays exactly as it was.
    if (event === "claim" || event === "claim-walked") {
      stock.potato -= 1;
      customers.push({
        took: { potato: 1 },
        declared: { potato: 2 },
        payment: "confirmed",
        claimed: { potato: 1 },
        note: "charged for 2 potatoes, took 1, and claimed a refund the grower has not decided yet",
      });
      if (event === "claim-walked") {
        stock.potato -= 1;
        customers.push({ took: { potato: 1 }, declared: {}, payment: "unpaid", note: "took a potato and paid nothing" });
      }
      continue;
    }
    const took = basket(stock);
    if (Object.keys(took).length === 0) took.onion = 1;
    if (event !== "abandoned") take(stock, took);
    const key = Object.keys(took)[0];
    if (event === "walker") customers.push({ took, declared: {}, payment: "unpaid", note: "took goods and paid nothing" });
    if (event === "underpay") {
      const declared = { ...took, [key]: took[key] - 1 };
      customers.push({ took, declared, payment: "confirmed", note: `paid for one ${key} fewer than taken` });
    }
    if (event === "overpay") {
      customers.push({ took, declared: { ...took, [key]: took[key] + 1 }, payment: "confirmed", note: `paid for one ${key} more than taken, and asked for no refund` });
    }
    if (event === "refund") {
      customers.push({
        took,
        declared: { ...took, [key]: took[key] + 1 },
        payment: "confirmed",
        returned: { [key]: 1 },
        note: `charged for one ${key} too many; refunded through Strawbank`,
      });
    }
    if (event === "pending") customers.push({ took, declared: { ...took }, payment: "pending", note: "paid in full; PayPal's webhook has not arrived yet" });
    if (event === "denied") customers.push({ took, declared: { ...took }, payment: "unpaid", note: "took goods; PayPal denied the capture" });
    if (event === "abandoned") customers.push({ took: {}, declared: took, payment: "unpaid", note: "started a checkout, then put everything back" });
  }

  for (const k of KEYS) if (stock[k] < 0) throw new Error(`day ${index}: negative stock`);
  const dusk = { ...stock };
  const duskConfidence: Counts = Object.fromEntries(KEYS.map((k) => [k, 0.95]));
  if (scenario.includes("unsure")) duskConfidence.potato = 0.55;

  // The truth, from the customers alone.
  const expected = Object.fromEntries(
    CATALOGUE.map(({ key, unitMinor }) => {
      let taken = 0;
      let paid = 0;
      let pending = 0;
      let paidFor = 0;
      let claimed = 0;
      for (const c of customers) {
        taken += c.took[key] ?? 0;
        const kept = Math.max(0, (c.declared[key] ?? 0) - (c.returned?.[key] ?? 0));
        if (c.payment === "confirmed") paid += kept;
        if (c.payment === "pending") pending += kept;
        if (c.payment !== "unpaid") paidFor += kept;
        if (c.payment === "confirmed") claimed += c.claimed?.[key] ?? 0;
      }
      const netWalked = taken - paidFor;
      return [key, { taken, paid, pending, claimed, netWalked, gapMinor: Math.max(0, taken - paid) * unitMinor }];
    }),
  );

  return {
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    scenario,
    catalogue: CATALOGUE,
    morning,
    restocks,
    customers,
    dusk,
    duskConfidence,
    expected,
  };
}

const dir = resolve(__dirname, "../truth/days");
mkdirSync(dir, { recursive: true });
SCENARIOS.forEach((scenario, i) => {
  const day = makeDay(i, scenario);
  writeFileSync(join(dir, `day-${String(i + 1).padStart(2, "0")}.json`), `${JSON.stringify(day, null, 2)}\n`);
});
console.log(`wrote ${SCENARIOS.length} days to ${dir}`);
