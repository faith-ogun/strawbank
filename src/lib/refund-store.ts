// F4's records, in Firestore at refundRequests/{requestId}: the customer's
// claim, the agent's recount, code's decision and, once one is reserved, the
// refund itself (field `refund`). `reserve` is one transaction: it sees every
// refund already made on the capture, through Strawbank or in PayPal itself
// (the signed-webhook ledger), so no request can refund more than is left
// (eval E4.2), and a request id that already has a refund never gets a second
// one (eval E4.3).

import { FieldValue, type Transaction } from "@google-cloud/firestore";
import { firestore } from "./firestore";
import type { LedgerCapture, LedgerRefund } from "./ledger";
import { type Currency, addMinor } from "./money";
import type { OrderLine } from "./orders";
import type { RefundRecord, RefundStatus, RefundStore, ReserveResult } from "./refunds";

export type RequestStatus = "WAITING" | "NONE" | "DECLINED" | RefundStatus;

export type RefundRequest = {
  requestId: string;
  orderId: string;
  standId: string;
  date: string;
  captureId: string;
  currency: Currency;
  lines: OrderLine[];
  /** What the customer says they took, per item key. */
  claimed: Record<string, number>;
  /** Charged minus claimed, per item: what the refund pays back for. */
  items: Record<string, number>;
  /** The agent's fresh count of the stored basket photo, if there was one. */
  recount?: Record<string, number>;
  recountConfidence?: number;
  /** The basket record behind the order, for the grower to look at. */
  countId?: string;
  route: "none" | "agent" | "grower";
  reasons: string[];
  amountMinor: number;
  status: RequestStatus;
  decidedBy?: "agent" | "grower";
  refund?: RefundRecord;
};

const requests = () => firestore().collection("refundRequests");

export async function saveRequest(request: RefundRequest): Promise<void> {
  await requests().doc(request.requestId).set({ ...request, createdAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function readRequest(requestId: string): Promise<RefundRequest | undefined> {
  return (await requests().doc(requestId).get()).data() as RefundRequest | undefined;
}

export async function updateRequest(requestId: string, update: Partial<RefundRequest>): Promise<void> {
  await requests().doc(requestId).set({ ...update, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function requestsForOrder(orderId: string): Promise<RefundRequest[]> {
  return (await requests().where("orderId", "==", orderId).get()).docs.map((d) => d.data() as RefundRequest);
}

export async function requestsForStand(standId: string): Promise<RefundRequest[]> {
  const snap = await requests().where("standId", "==", standId).get();
  return snap.docs.map((d) => d.data() as RefundRequest);
}

/** What is still refundable on a capture: its amount minus every refund on it, ours and PayPal's. */
async function leftOnCapture(tx: Transaction, captureId: string, ours: RefundRecord[]): Promise<{ capture?: LedgerCapture; leftMinor: number }> {
  const store = firestore();
  const capture = (await tx.get(store.collection("ledgerCaptures").doc(captureId))).data() as LedgerCapture | undefined;
  if (!capture || capture.status !== "COMPLETED") return { capture, leftMinor: 0 };
  const theirs = (await tx.get(store.collection("ledgerRefunds").where("captureId", "==", captureId))).docs.map((d) => d.data() as LedgerRefund);
  const known = new Set(ours.map((r) => r.paypalRefundId).filter(Boolean));
  const used = [
    ...ours.filter((r) => r.status !== "FAILED").map((r) => r.amountMinor),
    ...theirs.filter((r) => !known.has(r.refundId) && r.status !== "FAILED" && r.status !== "CANCELLED").map((r) => r.amountMinor),
  ].reduce((sum, n) => addMinor(sum, n), 0);
  return { capture, leftMinor: Math.max(0, capture.amountMinor - used) };
}

/** Refundable now, outside a reservation: for deciding the route before anything is reserved. */
export async function refundableNow(captureId: string): Promise<number> {
  const store = firestore();
  return store.runTransaction(async (tx) => {
    const ours = (await tx.get(requests().where("captureId", "==", captureId))).docs
      .map((d) => (d.data() as RefundRequest).refund)
      .filter((r): r is RefundRecord => r !== undefined);
    return (await leftOnCapture(tx, captureId, ours)).leftMinor;
  });
}

export const firestoreRefundStore: RefundStore = {
  async reserve(request): Promise<ReserveResult> {
    const store = firestore();
    const ref = requests().doc(request.requestId);
    return store.runTransaction(async (tx) => {
      const existing = (await tx.get(ref)).data() as RefundRequest | undefined;
      if (existing?.refund) return { kind: "exists", record: existing.refund };
      const ours = (await tx.get(requests().where("captureId", "==", request.captureId))).docs
        .map((d) => (d.data() as RefundRequest).refund)
        .filter((r): r is RefundRecord => r !== undefined);
      const { capture, leftMinor } = await leftOnCapture(tx, request.captureId, ours);
      if (!capture || capture.currency !== request.currency) return { kind: "over", refundableMinor: 0 };
      if (request.amountMinor <= 0 || request.amountMinor > leftMinor) return { kind: "over", refundableMinor: leftMinor };
      const record: RefundRecord = { ...request, status: "PENDING" };
      tx.set(ref, { refund: record, status: "PENDING", decidedBy: request.decidedBy, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { kind: "reserved", record };
    });
  },
  async settle(requestId, update) {
    const ref = requests().doc(requestId);
    await firestore().runTransaction(async (tx) => {
      const existing = (await tx.get(ref)).data() as RefundRequest | undefined;
      if (!existing?.refund) return;
      tx.set(ref, { refund: { ...existing.refund, ...update }, status: update.status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
  },
};
