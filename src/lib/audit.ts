// F5: the next-morning audit. Two independent records of the same day must
// agree: our ledger (PayPal's capture replies and signed webhooks) and PayPal's
// own Transaction Search, which can take up to three hours to show a
// transaction, so the audit runs the next morning. Anything in one and not the
// other, or with a different amount, is a difference for the grower to see: a
// missed webhook, a capture the ledger never heard of, a refund made in PayPal
// outside Strawbank. Eval E7 plants differences and checks they, and nothing
// else, are flagged.

import type { LedgerCapture, LedgerRefund } from "./ledger";
import { type Currency, toMinor } from "./money";

/** One PayPal transaction, as Transaction Search reports it (transaction_info). */
export type PayPalTransaction = {
  transactionId: string;
  /** For a refund, the capture it refunds. */
  referenceId?: string;
  /** Signed decimal, for example "4.50" or "-0.60". */
  amount: string;
  currency: string;
  /** S (success), P (pending), D (denied), V (reversed), F (partially refunded). */
  status?: string;
  /** Orders v2 custom_id: "<standId>/<YYYY-MM-DD>" on Strawbank's own orders. */
  customField?: string;
};

export type AuditDifference = {
  kind: "missing-in-ledger" | "missing-in-paypal" | "amount-differs" | "status-differs";
  what: "payment" | "refund";
  id: string;
  /** Plain words for the grower. */
  note: string;
};

export type AuditResult = {
  agree: boolean;
  payments: number;
  refunds: number;
  differences: AuditDifference[];
};

const minor = (t: PayPalTransaction, currency: Currency) => Math.abs(toMinor(t.amount.replace(/^-/, ""))) * (t.currency === currency ? 1 : NaN);

/**
 * Compares one stand's day. `captures` and `refunds` are the ledger's entries
 * for the day's orders; `transactions` is everything Transaction Search returned
 * around that day. Only PayPal transactions that belong to the stand's day are
 * compared: payments carrying its custom_id, and refunds of its payments.
 */
export function auditDay(input: {
  standId: string;
  date: string;
  currency: Currency;
  captures: LedgerCapture[];
  refunds: LedgerRefund[];
  transactions: PayPalTransaction[];
}): AuditResult {
  const tag = `${input.standId}/${input.date}`;
  const differences: AuditDifference[] = [];

  const ourCaptures = new Map(input.captures.map((c) => [c.captureId, c]));
  const paypalPayments = input.transactions.filter((t) => t.customField === tag && !t.amount.startsWith("-"));
  const paymentIds = new Set([...ourCaptures.keys(), ...paypalPayments.map((t) => t.transactionId)]);
  const paypalRefunds = input.transactions.filter((t) => t.amount.startsWith("-") && t.referenceId && paymentIds.has(t.referenceId));
  const ourRefunds = new Map(input.refunds.filter((r) => r.captureId && paymentIds.has(r.captureId)).map((r) => [r.refundId, r]));

  for (const t of paypalPayments) {
    const ours = ourCaptures.get(t.transactionId);
    if (!ours) {
      differences.push({ kind: "missing-in-ledger", what: "payment", id: t.transactionId, note: "PayPal has this payment; Strawbank's ledger never heard of it" });
      continue;
    }
    if (ours.amountMinor !== minor(t, input.currency)) {
      differences.push({ kind: "amount-differs", what: "payment", id: t.transactionId, note: "PayPal and the ledger disagree on the amount" });
    }
    if (ours.status === "COMPLETED" && t.status === "D") {
      differences.push({ kind: "status-differs", what: "payment", id: t.transactionId, note: "the ledger says paid; PayPal says denied" });
    }
  }
  for (const c of input.captures) {
    if (c.status !== "COMPLETED") continue;
    if (!paypalPayments.some((t) => t.transactionId === c.captureId)) {
      differences.push({ kind: "missing-in-paypal", what: "payment", id: c.captureId, note: "the ledger has this payment; PayPal's search does not show it" });
    }
  }

  for (const t of paypalRefunds) {
    const ours = ourRefunds.get(t.transactionId);
    if (!ours) {
      differences.push({ kind: "missing-in-ledger", what: "refund", id: t.transactionId, note: "a refund in PayPal that Strawbank's ledger never heard of, perhaps made in PayPal itself" });
    } else if (ours.amountMinor !== minor(t, input.currency)) {
      differences.push({ kind: "amount-differs", what: "refund", id: t.transactionId, note: "PayPal and the ledger disagree on the refund's amount" });
    }
  }
  for (const r of ourRefunds.values()) {
    if (r.status !== "COMPLETED") continue;
    if (!paypalRefunds.some((t) => t.transactionId === r.refundId)) {
      differences.push({ kind: "missing-in-paypal", what: "refund", id: r.refundId, note: "the ledger has this refund; PayPal's search does not show it" });
    }
  }

  return { agree: differences.length === 0, payments: paypalPayments.length, refunds: paypalRefunds.length, differences };
}
