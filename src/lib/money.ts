// Every amount of money in Honesty Box is a whole number of minor units
// (cents). Decimal strings appear only at the edges: the grower's price card
// on the way in, and PayPal's API on the way out. The model never produces
// an amount; see spec section 6.

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

// All three currencies use two decimal places in PayPal's API.
const MINOR_PER_MAJOR = 100;

export class MoneyError extends RangeError {}

export function isMinor(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

export function assertMinor(n: number, what = "amount"): number {
  if (!isMinor(n)) {
    throw new MoneyError(`${what} must be a whole, non-negative number of minor units, got ${n}`);
  }
  return n;
}

export function addMinor(a: number, b: number): number {
  return assertMinor(assertMinor(a) + assertMinor(b), "sum");
}

export function multiplyMinor(unitMinor: number, quantity: number): number {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a whole, non-negative number, got ${quantity}`);
  }
  return assertMinor(assertMinor(unitMinor) * quantity, "line total");
}

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "3.5" -> 350, "3.50" -> 350, "12" -> 1200. Anything else throws. */
export function toMinor(value: string): number {
  const match = DECIMAL.exec(value.trim());
  if (!match) throw new MoneyError(`not a price: "${value}"`);
  const [, whole, fraction = ""] = match;
  return assertMinor(Number(whole) * MINOR_PER_MAJOR + Number(fraction.padEnd(2, "0")));
}

/** 350 -> "3.50", the form PayPal expects in an amount's `value`. */
export function toDecimal(minor: number): string {
  assertMinor(minor);
  const whole = Math.floor(minor / MINOR_PER_MAJOR);
  const fraction = String(minor % MINOR_PER_MAJOR).padStart(2, "0");
  return `${whole}.${fraction}`;
}

export type PayPalAmount = { currency_code: Currency; value: string };

export function paypalAmount(minor: number, currency: Currency): PayPalAmount {
  return { currency_code: currency, value: toDecimal(minor) };
}

/** Parses a PayPal amount back into minor units, checking the currency. */
export function fromPayPalAmount(amount: { currency_code: string; value: string }, currency: Currency): number {
  if (amount.currency_code !== currency) {
    throw new MoneyError(`expected ${currency}, got ${amount.currency_code}`);
  }
  return toMinor(amount.value);
}

/** 350, "EUR" -> "€3.50", for people to read. Never parsed back. */
export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(
    assertMinor(minor) / MINOR_PER_MAJOR,
  );
}
