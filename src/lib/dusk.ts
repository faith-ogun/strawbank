// F3 on the server. The day's orders, and PayPal's word on each from the
// ledger (signed webhooks); the morning count and the dusk count the grower
// confirmed; then reconcileDay works out taken, paid and the gap per item
// (eval E5). The model puts the result into words, and its words are shown
// only if every number in them is one of the computed ones (eval E4.5).

import type { DocumentReference } from "@google-cloud/firestore";
import { explainDay } from "./ai/explain";
import { type Dusk, type PaymentSummary, readDay, saveDusk } from "./days";
import { explanationToShow } from "./explain-check";
import { firestore, whereIn } from "./firestore";
import type { LedgerCapture, LedgerRefund } from "./ledger";
import { type Currency, addMinor } from "./money";
import type { CatalogueItem } from "./orders";
import { type DaySale, allowedNumbers, paidQuantities, reconcileDay, templateExplanation } from "./reconcile";
import { type Sale, daySales } from "./sales";

/** A refund made through Strawbank (F4), with the quantities the customer did not take. */
export type RefundRequestRecord = { orderId: string; status: string; items?: Record<string, number> };

/** Each of the day's orders, with PayPal's word on whether it was paid. */
export async function paymentsForDay(standId: string, date: string): Promise<{ sales: Sale[]; payments: PaymentSummary[]; daySales: DaySale[] }> {
  const sales = await daySales(standId, date);
  if (sales.length === 0) return { sales, payments: [], daySales: [] };
  const store = firestore();

  const known = sales.filter((s) => s.captureId);
  const refs: DocumentReference[] = known.map((s) => store.collection("ledgerCaptures").doc(s.captureId!));
  const snaps = refs.length > 0 ? await store.getAll(...refs) : [];
  const captureByOrder = new Map<string, LedgerCapture>();
  for (const snap of snaps) {
    const capture = snap.data() as LedgerCapture | undefined;
    if (capture?.orderId) captureByOrder.set(capture.orderId, capture);
    else if (capture) captureByOrder.set(known.find((s) => s.captureId === snap.id)!.orderId, capture);
  }
  // An order whose capture response never reached us: the webhook may still have.
  const unknown = sales.filter((s) => !captureByOrder.has(s.orderId)).map((s) => s.orderId);
  for (const capture of await whereIn<LedgerCapture>("ledgerCaptures", "orderId", unknown)) {
    if (capture.orderId) captureByOrder.set(capture.orderId, capture);
  }

  const captureIds = [...captureByOrder.values()].map((c) => c.captureId);
  const refunds = await whereIn<LedgerRefund>("ledgerRefunds", "captureId", captureIds);
  const requests = await whereIn<RefundRequestRecord>("refundRequests", "orderId", sales.map((s) => s.orderId));

  const payments: PaymentSummary[] = [];
  const forDay: DaySale[] = [];
  for (const sale of sales) {
    const capture = captureByOrder.get(sale.orderId);
    let payment: PaymentSummary["payment"];
    let source: PaymentSummary["source"];
    if (capture) {
      // PayPal's word, from its capture reply to our server or its signed webhook (both, once the webhook lands).
      source = (capture as LedgerCapture & { confirmedByWebhook?: boolean }).confirmedByWebhook ? "webhook" : "capture";
      payment = capture.status === "COMPLETED" ? "confirmed" : capture.status === "DENIED" ? "unpaid" : "pending";
    } else if (sale.captureStatus === "COMPLETED" || sale.captureStatus === "PENDING") {
      source = "capture";
      payment = "pending";
    } else {
      source = "none";
      payment = "unpaid";
    }
    const captureId = capture?.captureId ?? sale.captureId;
    const refundedMinor = refunds
      .filter((r) => r.captureId === captureId && r.status === "COMPLETED")
      .reduce((sum, r) => addMinor(sum, r.amountMinor), 0);
    const returned: Record<string, number> = {};
    for (const request of requests.filter((r) => r.orderId === sale.orderId && r.status === "COMPLETED")) {
      for (const [key, n] of Object.entries(request.items ?? {})) returned[key] = (returned[key] ?? 0) + n;
    }
    payments.push({ orderId: sale.orderId, captureId, totalMinor: sale.totalMinor, payment, source, refundedMinor });
    forDay.push({ lines: sale.lines, payment, returned });
  }
  return { sales, payments, daySales: forDay };
}

/**
 * Closes the day: the grower's dusk counts against the morning's and the
 * day's payments. An item the grower did not change keeps the AI's confidence;
 * one the grower corrected counts as sure, because they counted it themselves.
 */
export async function closeDay(input: {
  standId: string;
  date: string;
  catalogue: CatalogueItem[];
  currency: Currency;
  counts: Record<string, number>;
}): Promise<Dusk> {
  const day = await readDay(input.standId, input.date);
  if (!day.morning) throw new Error("the stand was not set up this morning");
  const reading = day.duskReading;
  const confidence: Record<string, number> = {};
  for (const item of input.catalogue) {
    const ai = reading?.counts[item.key];
    confidence[item.key] = ai !== undefined && ai === input.counts[item.key] ? (reading?.confidence[item.key] ?? 0) : 1;
  }

  const { payments, daySales: forDay } = await paymentsForDay(input.standId, input.date);
  const { paid, pending } = paidQuantities(forDay);
  const items = reconcileDay(input.catalogue, {
    morning: day.morning.counts,
    restocks: day.restocks ?? [],
    dusk: input.counts,
    duskConfidence: confidence,
    paid,
    pending,
  });

  const confirmed = payments.filter((p) => p.payment === "confirmed");
  const takingsMinor = confirmed.reduce((sum, p) => addMinor(sum, p.totalMinor - Math.min(p.refundedMinor, p.totalMinor)), 0);
  const pendingCount = payments.filter((p) => p.payment === "pending").length;
  const modelText = await explainDay({
    items,
    currency: input.currency,
    takingsMinor,
    confirmedPayments: confirmed.length,
    pendingPayments: pendingCount,
  });
  const names = input.catalogue.flatMap((i) => [i.name, i.name.replace(/, each$/i, "")]);
  const shown = explanationToShow(
    modelText,
    allowedNumbers(items, [takingsMinor / 100, confirmed.length, pendingCount]),
    names,
    templateExplanation(items, input.currency),
  );

  const dusk: Dusk = {
    date: input.date,
    counts: input.counts,
    confidence,
    items,
    explanation: { text: shown.text, source: shown.source },
    payments,
    takingsMinor,
  };
  await saveDusk(input.standId, dusk);
  return dusk;
}

