// F3: dusk reconciliation. Per item, code works out what was taken (morning
// count + restocks - dusk count), what was paid for (from the ledger), and the
// gap. A low-confidence count makes the item "uncertain", never "missing".

import { type Currency, formatMoney, multiplyMinor } from "./money";
import type { CatalogueItem } from "./orders";

/** Below this, a shelf count is uncertain. */
export const MIN_SHELF_CONFIDENCE = 0.8;

export type ItemReconciliation = {
  key: string;
  name: string;
  unitMinor: number;
  morning: number;
  restocked: number;
  dusk: number;
  taken: number;
  paid: number;
  /** taken - paid. Positive: unaccounted for. Negative: more paid for than taken. */
  gap: number;
  /** Value of the unaccounted items, or 0 when the gap is not positive. */
  gapMinor: number;
  uncertain: boolean;
};

export type DayCounts = {
  morning: Record<string, number>;
  restocks: Record<string, number>[];
  dusk: Record<string, number>;
  /** Per item key, the model's confidence in the dusk count (0 to 1). */
  duskConfidence: Record<string, number>;
  /** Per item key, quantities in captured order lines, net of refunded quantities. */
  paid: Record<string, number>;
};

export function reconcileDay(catalogue: CatalogueItem[], counts: DayCounts): ItemReconciliation[] {
  return catalogue.map((item) => {
    const morning = counts.morning[item.key] ?? 0;
    const restocked = counts.restocks.reduce((sum, r) => sum + (r[item.key] ?? 0), 0);
    const dusk = counts.dusk[item.key] ?? 0;
    const taken = morning + restocked - dusk;
    const paid = counts.paid[item.key] ?? 0;
    const gap = taken - paid;
    const uncertain = taken < 0 || (counts.duskConfidence[item.key] ?? 0) < MIN_SHELF_CONFIDENCE;
    return {
      key: item.key,
      name: item.name,
      unitMinor: item.unitMinor,
      morning,
      restocked,
      dusk,
      taken,
      paid,
      gap,
      gapMinor: gap > 0 ? multiplyMinor(item.unitMinor, gap) : 0,
      uncertain,
    };
  });
}

/**
 * Every number the dusk explanation may mention: counts, prices and money
 * values in major units, plus anything from the history (for example a streak
 * of 3 Saturdays). The extra values come from code, never from the model.
 * Numbers inside item names are handled by the check, which removes the names.
 */
export function allowedNumbers(items: ItemReconciliation[], extra: number[] = []): number[] {
  const values = new Set<number>(extra.map(Math.abs));
  let totalGapMinor = 0;
  for (const item of items) {
    for (const n of [item.morning, item.restocked, item.dusk, item.taken, item.paid, item.gap]) values.add(Math.abs(n));
    values.add(item.unitMinor / 100);
    values.add(item.gapMinor / 100);
    totalGapMinor += item.gapMinor;
  }
  values.add(totalGapMinor / 100);
  return [...values];
}

/**
 * The explanation shown when the model's text fails the number check. It uses
 * only numbers from `allowedNumbers`, so it always passes that check.
 */
export function templateExplanation(items: ItemReconciliation[], currency: Currency): string {
  const sentences = items
    .filter((item) => item.taken !== 0 || item.paid !== 0)
    .map((item) => {
      if (item.uncertain) return `${item.name}: the count is uncertain, so nothing is reported missing.`;
      const base = `${item.name}: ${item.taken} taken, ${item.paid} paid for`;
      if (item.gap > 0) return `${base}, ${item.gap} unaccounted for (${formatMoney(item.gapMinor, currency)}).`;
      if (item.gap < 0) return `${base}, ${-item.gap} more paid for than taken.`;
      return `${base}.`;
    });
  return sentences.length > 0 ? sentences.join(" ") : "Nothing was taken today.";
}
