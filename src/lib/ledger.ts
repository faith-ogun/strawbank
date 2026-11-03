// The ledger: our own record of captures and refunds, built from PayPal's
// signed webhooks and from the capture response our server receives at
// checkout. Every fact is merged with a join, so a fact applied twice, or
// facts applied in any order, give the same ledger. That is what makes a
// duplicate or late webhook harmless (eval E4.4). Signature checking happens
// before anything reaches this module.

import { CURRENCIES, type Currency, toMinor } from "./money";

type CaptureStatus = "PENDING" | "COMPLETED" | "DENIED";
type RefundStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type CaptureFact = {
  kind: "capture";
  captureId: string;
  orderId?: string;
  amountMinor: number;
  currency: Currency;
  status: CaptureStatus;
};

export type RefundFact = {
  kind: "refund";
  refundId: string;
  captureId?: string;
  amountMinor: number;
  currency: Currency;
  status: RefundStatus;
};

export type LedgerFact = CaptureFact | RefundFact;

/** CONFLICT means two sources disagree; the grower sees it, and it never counts as paid. */
export type LedgerCapture = Omit<CaptureFact, "kind" | "status"> & { status: CaptureStatus | "CONFLICT" };
export type LedgerRefund = Omit<RefundFact, "kind" | "status"> & { status: RefundStatus | "CONFLICT" };

/** PayPal webhook event, after its signature has been verified. */
export type WebhookEvent = {
  id: string;
  event_type: string;
  resource: Record<string, unknown>;
};

// PENDING sits below every final status; two different final statuses join to CONFLICT.
function joinStatus<S extends string>(a: S | "CONFLICT", b: S | "CONFLICT"): S | "CONFLICT" {
  if (a === b) return a;
  if (a === "PENDING") return b;
  if (b === "PENDING") return a;
  return "CONFLICT";
}

function joinOptional(a: string | undefined, b: string | undefined): { value?: string; conflict: boolean } {
  if (a === undefined || a === b) return { value: b, conflict: false };
  if (b === undefined) return { value: a, conflict: false };
  return { value: a < b ? a : b, conflict: true };
}

function joinCommon<T extends { amountMinor: number; currency: Currency }>(a: T, b: T) {
  const conflict = a.amountMinor !== b.amountMinor || a.currency !== b.currency;
  return {
    amountMinor: Math.max(a.amountMinor, b.amountMinor),
    currency: a.currency < b.currency ? a.currency : b.currency,
    conflict,
  };
}

function joinCapture(a: LedgerCapture, b: LedgerCapture): LedgerCapture {
  const common = joinCommon(a, b);
  const order = joinOptional(a.orderId, b.orderId);
  const status = common.conflict || order.conflict ? "CONFLICT" : joinStatus(a.status, b.status);
  return { captureId: a.captureId, orderId: order.value, amountMinor: common.amountMinor, currency: common.currency, status };
}

function joinRefund(a: LedgerRefund, b: LedgerRefund): LedgerRefund {
  const common = joinCommon(a, b);
  const capture = joinOptional(a.captureId, b.captureId);
  const status = common.conflict || capture.conflict ? "CONFLICT" : joinStatus(a.status, b.status);
  return { refundId: a.refundId, captureId: capture.value, amountMinor: common.amountMinor, currency: common.currency, status };
}

function same(a: object | undefined, b: object): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

export class Ledger {
  readonly eventIds = new Set<string>();
  readonly captures = new Map<string, LedgerCapture>();
  readonly refunds = new Map<string, LedgerRefund>();

  /** Merges one fact. Returns whether the ledger changed. */
  record(fact: LedgerFact): boolean {
    if (fact.kind === "capture") {
      const { captureId, orderId, amountMinor, currency, status } = fact;
      const incoming: LedgerCapture = { captureId, orderId, amountMinor, currency, status };
      const before = this.captures.get(fact.captureId);
      const after = before ? joinCapture(before, incoming) : incoming;
      this.captures.set(fact.captureId, after);
      return !same(before, after);
    }
    const { refundId, captureId, amountMinor, currency, status } = fact;
    const incoming: LedgerRefund = { refundId, captureId, amountMinor, currency, status };
    const before = this.refunds.get(fact.refundId);
    const after = before ? joinRefund(before, incoming) : incoming;
    this.refunds.set(fact.refundId, after);
    return !same(before, after);
  }

  /** Applies a verified webhook event. A repeated event id changes nothing. */
  apply(event: WebhookEvent): boolean {
    if (this.eventIds.has(event.id)) return false;
    this.eventIds.add(event.id);
    let changed = false;
    for (const fact of factsFromWebhook(event)) changed = this.record(fact) || changed;
    return changed;
  }

  /** A plain, ordered copy, for comparing two ledgers and for storage. */
  snapshot() {
    const byKey = <T>(map: Map<string, T>) => [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    return { captures: byKey(this.captures), refunds: byKey(this.refunds) };
  }
}

function amountOf(resource: Record<string, unknown>): { amountMinor: number; currency: Currency } {
  const amount = resource.amount as { currency_code?: string; value?: string } | undefined;
  const currency = CURRENCIES.find((c) => c === amount?.currency_code);
  if (!currency || typeof amount?.value !== "string") throw new Error("webhook resource has no usable amount");
  return { amountMinor: toMinor(amount.value), currency };
}

// PayPal has both DENIED and DECLINED capture events (its event list, read 3 Nov);
// for the ledger both mean the money never arrived.
const CAPTURE_EVENTS: Record<string, CaptureStatus> = {
  "PAYMENT.CAPTURE.PENDING": "PENDING",
  "PAYMENT.CAPTURE.COMPLETED": "COMPLETED",
  "PAYMENT.CAPTURE.DENIED": "DENIED",
  "PAYMENT.CAPTURE.DECLINED": "DENIED",
};

const REFUND_STATUSES: RefundStatus[] = ["PENDING", "COMPLETED", "FAILED", "CANCELLED"];

/**
 * Webhook event -> ledger facts. Payload shapes follow PayPal's documented
 * capture and refund resources; check them against a real sandbox event in
 * spike S1 before relying on them.
 */
export function factsFromWebhook(event: WebhookEvent): LedgerFact[] {
  const resource = event.resource;
  const id = typeof resource.id === "string" ? resource.id : undefined;

  const captureStatus = CAPTURE_EVENTS[event.event_type];
  if (captureStatus && id) {
    const related = (resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined)?.related_ids;
    return [{ kind: "capture", captureId: id, orderId: related?.order_id, status: captureStatus, ...amountOf(resource) }];
  }

  if (event.event_type === "PAYMENT.CAPTURE.REFUNDED" && id) {
    const links = (resource.links as { rel?: string; href?: string }[] | undefined) ?? [];
    const up = links.find((link) => link.rel === "up")?.href;
    const captureId = up?.match(/\/captures\/([^/?]+)/)?.[1];
    const status = REFUND_STATUSES.find((s) => s === resource.status) ?? "PENDING";
    return [{ kind: "refund", refundId: id, captureId, status, ...amountOf(resource) }];
  }

  // CHECKOUT.ORDER.APPROVED and anything else carry no money; the event log keeps them.
  return [];
}
