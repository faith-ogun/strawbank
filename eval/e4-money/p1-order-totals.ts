import fc from "fast-check";
import { toMinor } from "../../src/lib/money";
import { MAX_QUANTITY, OrderError, buildLines, createOrderBody, orderTotalMinor } from "../../src/lib/orders";
import { assert, assertThrows, catalogueArb, currencyArb, keyArb, moneyProperty } from "./shared";

const basketArb = catalogueArb.chain((catalogue) =>
  fc.record({
    catalogue: fc.constant(catalogue),
    quantities: fc.tuple(...catalogue.map(() => fc.option(fc.integer({ min: 0, max: MAX_QUANTITY }), { nil: undefined }))),
    currency: currencyArb,
  }),
);

const totalsAgree = fc.property(basketArb, ({ catalogue, quantities, currency }) => {
  const counts = Object.fromEntries(
    catalogue.flatMap((item, i) => (quantities[i] === undefined ? [] : [[item.key, quantities[i]]])),
  );
  if (!Object.values(counts).some((q) => q > 0)) {
    assertThrows(() => buildLines(catalogue, counts), OrderError, "an empty basket must not become an order");
    return;
  }
  const lines = buildLines(catalogue, counts);
  const unit = createOrderBody(lines, currency, "day").purchase_units[0];

  // Worked out independently of src/lib/orders.ts.
  const expected = catalogue.reduce((sum, item) => sum + (counts[item.key] ?? 0) * item.unitMinor, 0);
  const amount = toMinor(unit.amount.value);
  const itemTotal = toMinor(unit.amount.breakdown.item_total.value);
  const sumOfItems = unit.items.reduce((sum, item) => sum + Number(item.quantity) * toMinor(item.unit_amount.value), 0);

  assert(amount === expected, `amount ${amount} != expected ${expected}`);
  assert(itemTotal === expected, `item_total ${itemTotal} != expected ${expected}`);
  assert(sumOfItems === expected, `sum of lines ${sumOfItems} != expected ${expected}`);
  assert(orderTotalMinor(lines) === expected, "orderTotalMinor disagrees");
  const codes = [unit.amount, unit.amount.breakdown.item_total, ...unit.items.map((i) => i.unit_amount)].map(
    (a) => a.currency_code,
  );
  assert(codes.every((c) => c === currency), "mixed currencies");
  assert(unit.items.every((i) => /^[1-9]\d?$/.test(i.quantity)), "quantity is not a whole number from 1 to 99");
});

const badQuantityArb = fc.oneof(
  fc.constantFrom(-1, MAX_QUANTITY + 1, 0.5),
  fc.integer({ max: -1 }),
  fc.integer({ min: MAX_QUANTITY + 1 }),
  fc.double({ noInteger: true }),
  fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY),
);

const badBasketsRejected = fc.property(
  catalogueArb,
  badQuantityArb,
  fc.boolean(),
  keyArb,
  (catalogue, quantity, unknownItem, key) => {
    fc.pre(!catalogue.some((item) => item.key === key));
    const counts = unknownItem ? { [catalogue[0].key]: 1, [key]: 1 } : { [catalogue[0].key]: quantity };
    assertThrows(() => buildLines(catalogue, counts), OrderError, "a bad basket must not become an order");
  },
);

export const p1 = [
  moneyProperty(
    "E4.1",
    "Order total = sum of lines (quantity x price) = PayPal item_total, in minor units",
    totalsAgree,
  ),
  moneyProperty(
    "E4.1b",
    "A basket with an unknown item or a quantity that is not a whole number from 0 to 99 never becomes an order",
    badBasketsRejected,
  ),
];
