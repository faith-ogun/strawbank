import fc from "fast-check";
import { type InvoiceStatus, invoiceBody, iouPayment, maskEmail } from "../../src/lib/ious";
import { toMinor } from "../../src/lib/money";
import { MAX_QUANTITY, buildLines, createOrderBody } from "../../src/lib/orders";
import { assert, catalogueArb, currencyArb, moneyProperty } from "./shared";

// The honesty-box IOU is a PayPal invoice, and it must ask for exactly what an
// order for the same basket would: the stand's own prices, line by line, in
// the stand's currency, no tip and no part payments. And an IOU counts as paid
// only when PayPal says it was paid, or the grower recorded cash in PayPal.

const iouCase = catalogueArb.chain((catalogue) =>
  fc.record({
    catalogue: fc.constant(catalogue),
    quantities: fc.tuple(...catalogue.map(() => fc.integer({ min: 0, max: MAX_QUANTITY }))),
    currency: currencyArb,
    local: fc.stringMatching(/^[a-z0-9._-]{1,20}$/),
  }),
);

const invoiceMatchesOrder = fc.property(iouCase, ({ catalogue, quantities, currency, local }) => {
  const counts = Object.fromEntries(catalogue.map((item, i) => [item.key, quantities[i]]));
  fc.pre(Object.values(counts).some((q) => q > 0));
  const lines = buildLines(catalogue, counts);
  const email = `${local}@example.ie`;
  const body = invoiceBody({ lines, currency, email, standName: "Test stand", standId: "demo", date: "2026-11-03" });
  const order = createOrderBody(lines, currency, "ref").purchase_units[0];

  // Worked out independently of src/lib/ious.ts and src/lib/orders.ts.
  const expected = catalogue.reduce((sum, item) => sum + counts[item.key] * item.unitMinor, 0);
  const invoiced = body.items.reduce((sum, item) => sum + Number(item.quantity) * toMinor(item.unit_amount.value), 0);
  assert(invoiced === expected, `the invoice asks for ${invoiced}, the basket costs ${expected}`);
  assert(invoiced === toMinor(order.amount.value), "the invoice and the order for the same basket disagree");
  assert(body.items.every((i) => i.unit_amount.currency_code === currency) && body.detail.currency_code === currency, "mixed currencies");
  assert(body.items.every((i) => /^[1-9]\d?$/.test(i.quantity)), "a quantity is not a whole number from 1 to 99");
  assert(!body.configuration.allow_tip && !body.configuration.partial_payment.allow_partial_payment, "tips or part payments allowed");
  assert(body.primary_recipients[0].billing_info.email_address === email, "the invoice goes to someone else");
  assert(maskEmail(email) === `${local[0]}…@example.ie`, "the masked address shows more than its first letter");
});

const STATUSES: InvoiceStatus[] = ["DRAFT", "SENT", "SCHEDULED", "UNPAID", "PARTIALLY_PAID", "PAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED", "MARKED_AS_REFUNDED", "PAYMENT_PENDING"];

const paidOnlyWhenPaid = fc.property(fc.constantFrom(...STATUSES), (status) => {
  const payment = iouPayment(status);
  assert((payment === "confirmed") === (status === "PAID" || status === "MARKED_AS_PAID"), `${status} counted as ${payment}`);
});

export const p9 = [
  moneyProperty("E4.10", "An IOU invoice asks for exactly what an order for the same basket would, to the address given", invoiceMatchesOrder),
  moneyProperty("E4.11", "An IOU counts as paid only when PayPal says it was paid or the grower recorded cash", paidOnlyWhenPaid, STATUSES.length * 4),
];
