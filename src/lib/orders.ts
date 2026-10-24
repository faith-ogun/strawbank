// F2 step 4: code, never the model, turns the customer's confirmed counts and
// the grower's confirmed prices into order lines, a total, and the Orders v2
// request body. Eval E4.1 checks that the three totals always agree.

import {
  type Currency,
  type PayPalAmount,
  addMinor,
  assertMinor,
  multiplyMinor,
  paypalAmount,
  toDecimal,
} from "./money";

export type CatalogueItem = {
  key: string;
  name: string;
  unitMinor: number;
  /** Catalog Products id, once `create_product` has run for this item. */
  productId?: string;
};

export type OrderLine = {
  key: string;
  name: string;
  quantity: number;
  unitMinor: number;
};

/** A sanity cap per line. A farm stand basket never holds 100 of one thing. */
export const MAX_QUANTITY = 99;

// PayPal's limit on an item's `name` and `sku`.
const PAYPAL_TEXT_MAX = 127;

export class OrderError extends Error {}

export function checkCatalogue(catalogue: CatalogueItem[]): void {
  const seen = new Set<string>();
  for (const item of catalogue) {
    if (seen.has(item.key)) throw new OrderError(`"${item.key}" is listed twice`);
    seen.add(item.key);
    if (!item.key || item.key.length > PAYPAL_TEXT_MAX) throw new OrderError(`bad item key "${item.key}"`);
    // A name needs a letter: the explanation check removes item names, and a bare number is not a name.
    if (!/\p{L}/u.test(item.name) || item.name.length > PAYPAL_TEXT_MAX) throw new OrderError(`bad name for "${item.key}"`);
    assertMinor(item.unitMinor, `price of "${item.key}"`);
    if (item.unitMinor === 0) throw new OrderError(`"${item.key}" has no price`);
  }
}

/** Counts per item key -> order lines, in catalogue order. Throws on anything odd. */
export function buildLines(catalogue: CatalogueItem[], counts: Record<string, number>): OrderLine[] {
  checkCatalogue(catalogue);
  const known = new Set(catalogue.map((item) => item.key));
  for (const [key, quantity] of Object.entries(counts)) {
    if (!known.has(key)) throw new OrderError(`"${key}" is not on today's list`);
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY) {
      throw new OrderError(`bad quantity ${quantity} for "${key}"`);
    }
  }
  const lines = catalogue
    .filter((item) => Object.hasOwn(counts, item.key) && counts[item.key] > 0)
    .map((item) => ({ key: item.key, name: item.name, quantity: counts[item.key], unitMinor: item.unitMinor }));
  if (lines.length === 0) throw new OrderError("the basket is empty");
  return lines;
}

export function lineTotalMinor(line: OrderLine): number {
  return multiplyMinor(line.unitMinor, line.quantity);
}

export function orderTotalMinor(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => addMinor(sum, lineTotalMinor(line)), 0);
}

export type CreateOrderBody = {
  intent: "CAPTURE";
  purchase_units: [
    {
      reference_id: string;
      amount: PayPalAmount & { breakdown: { item_total: PayPalAmount } };
      items: {
        name: string;
        sku: string;
        quantity: string;
        unit_amount: PayPalAmount;
        category: "PHYSICAL_GOODS";
      }[];
    },
  ];
};

/**
 * The body for `POST /v2/checkout/orders`. Prices already include any tax, so
 * the total is the item total; there is no shipping, tax or discount line.
 */
export function createOrderBody(lines: OrderLine[], currency: Currency, referenceId: string): CreateOrderBody {
  const total = orderTotalMinor(lines);
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId,
        amount: {
          currency_code: currency,
          value: toDecimal(total),
          breakdown: { item_total: paypalAmount(total, currency) },
        },
        items: lines.map((line) => ({
          name: line.name,
          sku: line.key,
          quantity: String(line.quantity),
          unit_amount: paypalAmount(line.unitMinor, currency),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
  };
}
