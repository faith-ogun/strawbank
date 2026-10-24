import fc from "fast-check";
import { type LedgerFact, Ledger, type WebhookEvent } from "../../src/lib/ledger";
import { type Currency, toDecimal } from "../../src/lib/money";
import { assert, currencyArb, moneyProperty } from "./shared";

type CaptureStatus = "PENDING" | "COMPLETED" | "DENIED";
type RefundStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

const historyArb = fc.record({
  currency: currencyArb,
  captures: fc.uniqueArray(
    fc.record({
      captureId: fc.integer({ min: 1, max: 999 }).map((n) => `CAP-${n}`),
      orderId: fc.integer({ min: 1, max: 999 }).map((n) => `ORD-${n}`),
      amountMinor: fc.integer({ min: 1, max: 100_000 }),
      statuses: fc.subarray<CaptureStatus>(["PENDING", "COMPLETED", "DENIED"], { minLength: 1 }),
      /** Rarely, one event carries a different amount. */
      oddAmount: fc.option(fc.integer({ min: 1, max: 100_000 }), { freq: 10, nil: undefined }),
      /** Our server also saw the capture in the capture response. */
      seenAtCheckout: fc.boolean(),
      refunds: fc.array(
        fc.record({
          amountMinor: fc.integer({ min: 1, max: 100_000 }),
          status: fc.constantFrom<RefundStatus>("PENDING", "COMPLETED", "FAILED", "CANCELLED"),
        }),
        { maxLength: 3 },
      ),
    }),
    { selector: (c) => c.captureId, maxLength: 6 },
  ),
  noise: fc.nat(3),
});

type History = typeof historyArb extends fc.Arbitrary<infer H> ? H : never;
type Delivery = { event: WebhookEvent } | { fact: LedgerFact };

const amount = (minor: number, currency: Currency) => ({ currency_code: currency, value: toDecimal(minor) });

type HistoryCapture = History["captures"][number];

/** An odd amount only conflicts when some other source reports the same capture. */
function hasOddAmount(c: HistoryCapture): boolean {
  const sources = c.statuses.length + (c.seenAtCheckout && c.statuses.includes("COMPLETED") ? 1 : 0);
  return c.oddAmount !== undefined && c.oddAmount !== c.amountMinor && sources > 1;
}

function deliveriesFor(h: History): Delivery[] {
  const out: Delivery[] = [];
  let n = 0;
  for (const c of h.captures) {
    c.statuses.forEach((status, i) => {
      const odd = i === c.statuses.length - 1 && hasOddAmount(c) ? c.oddAmount! : c.amountMinor;
      out.push({
        event: {
          id: `WH-${n++}`,
          event_type: `PAYMENT.CAPTURE.${status}`,
          resource: {
            id: c.captureId,
            status,
            amount: amount(odd, h.currency),
            supplementary_data: { related_ids: { order_id: c.orderId } },
          },
        },
      });
    });
    if (c.seenAtCheckout && c.statuses.includes("COMPLETED")) {
      out.push({
        fact: { kind: "capture", captureId: c.captureId, orderId: c.orderId, amountMinor: c.amountMinor, currency: h.currency, status: "COMPLETED" },
      });
    }
    c.refunds.forEach((r, i) => {
      out.push({
        event: {
          id: `WH-${n++}`,
          event_type: "PAYMENT.CAPTURE.REFUNDED",
          resource: {
            id: `RF-${c.captureId}-${i}`,
            status: r.status,
            amount: amount(r.amountMinor, h.currency),
            links: [{ rel: "up", href: `https://api.sandbox.paypal.com/v2/payments/captures/${c.captureId}` }],
          },
        },
      });
    });
  }
  for (let i = 0; i < h.noise; i++) {
    out.push({ event: { id: `WH-${n++}`, event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: `ORD-${i}` } } });
  }
  return out;
}

function deliver(ledger: Ledger, d: Delivery): boolean {
  return "event" in d ? ledger.apply(d.event) : ledger.record(d.fact);
}

/** What each capture's status should end up as, worked out from the history itself. */
function expectedStatus(c: HistoryCapture): string {
  if (hasOddAmount(c)) return "CONFLICT";
  const done = c.statuses.includes("COMPLETED");
  const denied = c.statuses.includes("DENIED");
  if (done && denied) return "CONFLICT";
  return done ? "COMPLETED" : denied ? "DENIED" : "PENDING";
}

const scenarioArb = historyArb.chain((h) => {
  const unique = deliveriesFor(h);
  return fc.record({
    history: fc.constant(h),
    unique: fc.constant(unique),
    // Every delivery at least once, some repeated, in any order.
    delivered: fc
      .array(fc.nat(Math.max(0, unique.length - 1)), { maxLength: unique.length === 0 ? 0 : 12 })
      .chain((repeats) => {
        const all = [...unique, ...repeats.map((i) => unique[i])];
        return fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length });
      }),
  });
});

const ledgerCountsOnce = fc.property(scenarioArb, ({ history, unique, delivered }) => {
  const canonical = new Ledger();
  for (const d of unique) deliver(canonical, d);
  const ledger = new Ledger();
  for (const d of delivered) deliver(ledger, d);

  const snapshot = JSON.stringify(ledger.snapshot());
  assert(snapshot === JSON.stringify(canonical.snapshot()), "repeats or order changed the ledger");

  for (const d of delivered) assert(!deliver(ledger, d), "a repeated delivery changed the ledger");
  assert(JSON.stringify(ledger.snapshot()) === snapshot, "replaying deliveries changed the ledger");

  for (const c of history.captures) {
    const status = ledger.captures.get(c.captureId)?.status;
    assert(status === expectedStatus(c), `${c.captureId} ended as ${status}, expected ${expectedStatus(c)}`);
  }
  const paid = [...ledger.captures.values()].filter((c) => c.status === "COMPLETED").reduce((s, c) => s + c.amountMinor, 0);
  const expectedPaid = history.captures
    .filter((c) => expectedStatus(c) === "COMPLETED")
    .reduce((s, c) => s + c.amountMinor, 0);
  assert(paid === expectedPaid, `captured total ${paid}, expected ${expectedPaid}`);
});

export const p4 = [
  moneyProperty("E4.4", "A duplicate or late webhook never changes the ledger twice", ledgerCountsOnce),
];
