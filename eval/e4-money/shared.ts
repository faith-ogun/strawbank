import fc from "fast-check";
import { CURRENCIES } from "../../src/lib/money";
import type { CatalogueItem } from "../../src/lib/orders";

export type MoneyProperty = {
  id: string;
  claim: string;
  /** Overrides the run count, for checks with only one case. */
  runs?: number;
  check(params: fc.Parameters<unknown>): Promise<fc.RunDetails<unknown>>;
};

/** Wraps a fast-check property so properties with different inputs can sit in one list. */
export function moneyProperty<Ts>(
  id: string,
  claim: string,
  property: fc.IRawProperty<Ts>,
  runs?: number,
): MoneyProperty {
  return {
    id,
    claim,
    runs,
    check: async (params) => (await fc.check(property, params as fc.Parameters<Ts>)) as fc.RunDetails<unknown>,
  };
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertThrows(fn: () => unknown, kind: new (...args: never[]) => Error, message: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof kind) return;
    throw new Error(`${message}: threw ${(error as Error).name} instead`);
  }
  throw new Error(`${message}: did not throw`);
}

export const currencyArb = fc.constantFrom(...CURRENCIES);

export const keyArb = fc.stringMatching(/^[a-z][a-z0-9]{0,8}(?:-[a-z0-9]{1,6}){0,2}$/);

export const nameArb = fc.oneof(
  fc.constantFrom("Jam", "Free-range eggs (6)", "Honey", "Rhubarb", "Sweet pea bunch", "Plums (1kg bag)"),
  fc.string({ minLength: 1, maxLength: 40 }).map((s) => `Item ${s}`),
);

export const catalogueArb: fc.Arbitrary<CatalogueItem[]> = fc.uniqueArray(
  fc.record({ key: keyArb, name: nameArb, unitMinor: fc.integer({ min: 1, max: 100_000 }) }),
  { selector: (item) => item.key, minLength: 1, maxLength: 10 },
);
