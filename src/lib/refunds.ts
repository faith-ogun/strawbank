// F4: refunds. Code works out the amount, the cap and who decides. The agent
// may only carry out a refund this module has already approved. Evals E4.2
// and E4.3 check that a refund never exceeds what is left on the capture and
// that one request never produces two refunds.

import { type Currency, addMinor, assertMinor, multiplyMinor } from "./money";
import type { OrderLine } from "./orders";

export type RefundStatus = "PENDING" | "COMPLETED" | "FAILED";

export type RefundRecord = {
  requestId: string;
  captureId: string;
  amountMinor: number;
  currency: Currency;
  status: RefundStatus;
  decidedBy: "agent" | "grower";
  paypalRefundId?: string;
};

export type CaptureRecord = {
  captureId: string;
  amountMinor: number;
  currency: Currency;
};

/**
 * Captured amount minus every refund that has not definitely failed. A refund
 * whose outcome is unknown (PENDING) still counts against the capture.
 */
export function refundableMinor(capture: CaptureRecord, refunds: RefundRecord[]): number {
  const used = refunds
    .filter((r) => r.captureId === capture.captureId && r.status !== "FAILED")
    .reduce((sum, r) => addMinor(sum, r.amountMinor), 0);
  return Math.max(0, assertMinor(capture.amountMinor) - used);
}

/** For each line, (charged - accepted) x price, never below zero. */
export function refundDueMinor(lines: OrderLine[], accepted: Record<string, number>): number {
  return lines.reduce((sum, line) => {
    const keep = accepted[line.key] ?? 0;
    return addMinor(sum, multiplyMinor(line.unitMinor, Math.max(0, line.quantity - keep)));
  }, 0);
}

export type RefundDecision =
  | { route: "none"; reasons: string[] }
  | { route: "agent"; amountMinor: number }
  | { route: "grower"; amountMinor: number; reasons: string[] };

/** Below this, a recount is "uncertain" and goes to the grower. */
export const MIN_RECOUNT_CONFIDENCE = 0.8;

/**
 * Who handles a "something's wrong" claim, and for how much.
 *
 * `claimed` is what the customer says they took; `recount` is the model's
 * fresh count of the stored basket photo. The recount supports the claim when,
 * for every item the customer says they took fewer of, it sees no more than
 * the customer claims.
 */
export function decideRefund(input: {
  lines: OrderLine[];
  claimed: Record<string, number>;
  recount: Record<string, number>;
  recountConfidence: number;
  refundableMinor: number;
  limitMinor: number;
}): RefundDecision {
  const due = refundDueMinor(input.lines, input.claimed);
  if (due === 0) return { route: "none", reasons: ["the claim matches what was charged"] };

  const amountMinor = Math.min(due, assertMinor(input.refundableMinor));
  if (amountMinor === 0) return { route: "none", reasons: ["nothing left to refund on this payment"] };

  const reasons: string[] = [];
  if (amountMinor < due) reasons.push("earlier refunds leave less than the claim");
  const contradicted = input.lines.filter((line) => {
    const claimed = input.claimed[line.key] ?? 0;
    return claimed < line.quantity && (input.recount[line.key] ?? 0) > claimed;
  });
  if (contradicted.length > 0) reasons.push("the photo does not support the claim");
  if (input.recountConfidence < MIN_RECOUNT_CONFIDENCE) reasons.push("the recount is uncertain");
  if (amountMinor > assertMinor(input.limitMinor)) reasons.push("over the grower's limit");

  return reasons.length === 0 ? { route: "agent", amountMinor } : { route: "grower", amountMinor, reasons };
}

export type ReserveResult =
  | { kind: "reserved"; record: RefundRecord }
  | { kind: "exists"; record: RefundRecord }
  | { kind: "over"; refundableMinor: number };

/**
 * Where refunds are recorded. `reserve` must be atomic: in Firestore it is a
 * single transaction keyed on the request id.
 */
export interface RefundStore {
  reserve(request: Omit<RefundRecord, "status" | "paypalRefundId">): ReserveResult | Promise<ReserveResult>;
  settle(requestId: string, update: { status: RefundStatus; paypalRefundId?: string }): void | Promise<void>;
}

/** Calls PayPal (`create_refund`). `idempotencyKey` goes in the PayPal-Request-Id header. */
export interface RefundGateway {
  refund(input: {
    captureId: string;
    amountMinor: number;
    currency: Currency;
    idempotencyKey: string;
  }): Promise<{ paypalRefundId: string; status: "COMPLETED" | "PENDING" }>;
}

/** PayPal said no (for example, 422 refund exceeds the capture). Safe to free the amount. */
export class RefundRejected extends Error {}

export type RefundOutcome =
  | { kind: "refunded"; record: RefundRecord }
  | { kind: "duplicate"; record: RefundRecord }
  | { kind: "over"; refundableMinor: number }
  | { kind: "rejected"; record: RefundRecord }
  | { kind: "unknown"; record: RefundRecord };

/**
 * Carries out an approved refund at most once per request id. A repeat of the
 * same request returns the first record and never calls PayPal again. If the
 * call fails in a way that leaves the outcome unknown, the refund stays
 * PENDING, still counts against the capture, and is settled later from the
 * webhook or `get_refund`.
 */
export async function issueRefund(
  store: RefundStore,
  gateway: RefundGateway,
  request: Omit<RefundRecord, "status" | "paypalRefundId">,
): Promise<RefundOutcome> {
  const reserved = await store.reserve(request);
  if (reserved.kind === "over") return reserved;
  if (reserved.kind === "exists") return { kind: "duplicate", record: reserved.record };

  const record = reserved.record;
  try {
    const result = await gateway.refund({
      captureId: record.captureId,
      amountMinor: record.amountMinor,
      currency: record.currency,
      idempotencyKey: `refund-${record.requestId}`,
    });
    const settled = { status: result.status, paypalRefundId: result.paypalRefundId } as const;
    await store.settle(record.requestId, settled);
    return { kind: "refunded", record: { ...record, ...settled } };
  } catch (error) {
    if (error instanceof RefundRejected) {
      await store.settle(record.requestId, { status: "FAILED" });
      return { kind: "rejected", record: { ...record, status: "FAILED" } };
    }
    return { kind: "unknown", record };
  }
}

/** In-memory store for local runs and the eval. JavaScript runs `reserve` without interruption. */
export class MemoryRefundStore implements RefundStore {
  readonly refunds = new Map<string, RefundRecord>();

  constructor(private readonly captures: Map<string, CaptureRecord>) {}

  reserve(request: Omit<RefundRecord, "status" | "paypalRefundId">): ReserveResult {
    const existing = this.refunds.get(request.requestId);
    if (existing) return { kind: "exists", record: existing };
    const capture = this.captures.get(request.captureId);
    if (!capture || capture.currency !== request.currency) return { kind: "over", refundableMinor: 0 };
    const left = refundableMinor(capture, [...this.refunds.values()]);
    if (assertMinor(request.amountMinor) === 0 || request.amountMinor > left) {
      return { kind: "over", refundableMinor: left };
    }
    const record: RefundRecord = { ...request, status: "PENDING" };
    this.refunds.set(request.requestId, record);
    return { kind: "reserved", record };
  }

  settle(requestId: string, update: { status: RefundStatus; paypalRefundId?: string }): void {
    const record = this.refunds.get(requestId);
    if (record) this.refunds.set(requestId, { ...record, ...update });
  }
}
