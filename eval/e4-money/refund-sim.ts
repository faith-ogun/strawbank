// A simulated PayPal and a stream of refund requests, some repeated, some
// concurrent, some failing. Shared by E4.2 and E4.3.

import fc from "fast-check";
import type { Currency } from "../../src/lib/money";
import {
  type CaptureRecord,
  type RefundGateway,
  type RefundOutcome,
  MemoryRefundStore,
  RefundRejected,
  issueRefund,
} from "../../src/lib/refunds";
import { currencyArb } from "./shared";

type Outcome = "completed" | "pending" | "rejected" | "lost";

/**
 * Behaves like PayPal: refuses a refund larger than what is left on the
 * capture, and otherwise does what the scenario says. "lost" means PayPal made
 * the refund but the answer never reached us.
 */
export class FakePayPal implements RefundGateway {
  readonly refunded = new Map<string, number>();
  readonly callsByKey = new Map<string, number>();
  readonly refundsByKey = new Map<string, number>();
  overRefundsRefused = 0;

  constructor(
    private readonly captures: Map<string, CaptureRecord>,
    private readonly outcomes: Map<string, Outcome>,
  ) {}

  async refund(input: { captureId: string; amountMinor: number; currency: Currency; idempotencyKey: string }) {
    this.callsByKey.set(input.idempotencyKey, (this.callsByKey.get(input.idempotencyKey) ?? 0) + 1);
    for (let i = 0; i < input.amountMinor % 4; i++) await Promise.resolve(); // let other requests interleave

    const capture = this.captures.get(input.captureId);
    const done = this.refunded.get(input.captureId) ?? 0;
    if (!capture || input.amountMinor > capture.amountMinor - done) {
      this.overRefundsRefused++;
      throw new RefundRejected("refund exceeds the captured amount");
    }
    const outcome = this.outcomes.get(input.idempotencyKey) ?? "completed";
    if (outcome === "rejected") throw new RefundRejected("declined");
    this.refunded.set(input.captureId, done + input.amountMinor);
    this.refundsByKey.set(input.idempotencyKey, (this.refundsByKey.get(input.idempotencyKey) ?? 0) + 1);
    if (outcome === "lost") throw new Error("socket hang up");
    return { paypalRefundId: `RF-${input.idempotencyKey}`, status: outcome === "pending" ? "PENDING" : "COMPLETED" } as const;
  }
}

export const scenarioArb = fc.record({
  currency: currencyArb,
  captures: fc.array(fc.integer({ min: 1, max: 50_000 }), { minLength: 1, maxLength: 3 }),
  requests: fc.array(
    fc.record({
      requestNo: fc.integer({ min: 0, max: 7 }),
      captureNo: fc.nat(2),
      amountMinor: fc.integer({ min: 0, max: 60_000 }),
      outcome: fc.constantFrom<Outcome>("completed", "pending", "rejected", "lost"),
    }),
    { minLength: 1, maxLength: 25 },
  ),
  /** How many requests arrive at once. */
  width: fc.integer({ min: 1, max: 6 }),
});

export type Scenario = typeof scenarioArb extends fc.Arbitrary<infer S> ? S : never;

export async function simulate(s: Scenario) {
  const captures = new Map<string, CaptureRecord>(
    s.captures.map((amountMinor, i) => [`CAP-${i}`, { captureId: `CAP-${i}`, amountMinor, currency: s.currency }]),
  );
  const outcomes = new Map<string, Outcome>();
  for (const r of s.requests) if (!outcomes.has(`refund-REQ-${r.requestNo}`)) outcomes.set(`refund-REQ-${r.requestNo}`, r.outcome);

  const store = new MemoryRefundStore(captures);
  const paypal = new FakePayPal(captures, outcomes);
  const results: { requestId: string; outcome: RefundOutcome }[] = [];

  for (let i = 0; i < s.requests.length; i += s.width) {
    const batch = s.requests.slice(i, i + s.width).map(async (r) => {
      const requestId = `REQ-${r.requestNo}`;
      const outcome = await issueRefund(store, paypal, {
        requestId,
        captureId: `CAP-${r.captureNo % captures.size}`,
        amountMinor: r.amountMinor,
        currency: s.currency,
        decidedBy: "agent",
      });
      results.push({ requestId, outcome });
    });
    await Promise.all(batch);
  }
  return { captures, store, paypal, results };
}
