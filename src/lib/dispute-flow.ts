// Disputes end to end. PayPal lists every dispute on the merchant account;
// each is matched to the stand through its capture (our ledger) and the order
// that capture paid for (our sales record). For a dispute at the grower's
// stand, the evidence pack is built from that record (src/lib/dispute-
// evidence.ts, eval E4.13) and sent only when the grower presses the button.
// A signed CUSTOMER.DISPUTE.* webhook puts a hold on the basket photo, so the
// 30-day delete rule cannot remove evidence while the dispute is open.

import type { Timestamp } from "@google-cloud/firestore";
import { FieldValue } from "@google-cloud/firestore";
import { type EvidencePack, evidenceNotes, evidenceType } from "./dispute-evidence";
import { firestore, whereIn } from "./firestore";
import type { LedgerCapture, LedgerRefund, WebhookEvent } from "./ledger";
import { addMinor } from "./money";
import { noted } from "./paypal/calls";
import {
  type Dispute,
  acceptClaim,
  adjudicate,
  canDo,
  getDispute,
  listDisputes,
  offersSandboxStep,
  provideEvidence,
  requestedFromSeller,
  requireSellerEvidence,
} from "./paypal/disputes";
import { getPayPalOrder } from "./paypal/orders";
import { holdPhoto, readPhoto } from "./photos";
import { type BasketRecord, type Sale, readBasket, readSale } from "./sales";
import { findStand } from "./demo-stand";

export class DisputeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type StandDispute = { dispute: Dispute; pack: EvidencePack; countId?: string; evidenceSentAt?: string };

const iso = (t: unknown) => (t && typeof (t as Timestamp).toDate === "function" ? (t as Timestamp).toDate().toISOString() : undefined);

/** The stand's own record behind a capture: the ledger entry, the sale and its basket. */
async function recordFor(captureId: string): Promise<{ capture: LedgerCapture & { confirmedByWebhook?: boolean }; sale: Sale & { capturedAt?: unknown }; basket?: BasketRecord & { at?: unknown } } | undefined> {
  const capture = (await firestore().collection("ledgerCaptures").doc(captureId).get()).data() as (LedgerCapture & { confirmedByWebhook?: boolean }) | undefined;
  const orderId = capture?.orderId;
  if (!capture || !orderId) return undefined;
  const sale = (await readSale(orderId)) as (Sale & { capturedAt?: unknown }) | undefined;
  if (!sale) return undefined;
  const basket = sale.countId ? ((await readBasket(sale.countId)) as (BasketRecord & { at?: unknown }) | undefined) : undefined;
  return { capture, sale, basket };
}

async function packFor(dispute: Dispute, record: NonNullable<Awaited<ReturnType<typeof recordFor>>>): Promise<EvidencePack> {
  const { capture, sale, basket } = record;
  const refunds = await whereIn<LedgerRefund>("ledgerRefunds", "captureId", [capture.captureId]);
  const order = await getPayPalOrder(sale.orderId).catch(() => undefined);
  const pickup = String(order?.purchaseUnits?.[0]?.shipping?.type ?? "") === "PICKUP_IN_STORE";
  const taken = iso(basket?.at);
  return {
    disputeId: dispute.dispute_id,
    standName: findStand(sale.standId)?.stand.name ?? sale.standId,
    orderId: sale.orderId,
    captureId: capture.captureId,
    capturedAt: iso(sale.capturedAt),
    date: sale.date,
    lines: sale.lines,
    capturedMinor: capture.amountMinor,
    currency: capture.currency,
    confirmedByWebhook: Boolean(capture.confirmedByWebhook),
    collectedAtStand: pickup,
    photo: basket && taken ? { taken } : undefined,
    refundedMinor: refunds.filter((r) => r.status === "COMPLETED").reduce((sum, r) => addMinor(sum, r.amountMinor), 0),
  };
}

const captureOf = (dispute: Dispute) => dispute.disputed_transactions?.find((t) => t.seller_transaction_id)?.seller_transaction_id;

/** Every PayPal dispute on a payment made at this stand, with its evidence pack. */
export async function disputesForStand(standId: string): Promise<StandDispute[]> {
  const { disputes } = await noted(
    { standId, who: "grower", what: "list the disputes customers have opened with PayPal", endpoint: "GET /v1/customer/disputes" },
    () => listDisputes(),
    (r) => ({ status: 200, debugId: r.debugId, ref: `${r.disputes.length} dispute${r.disputes.length === 1 ? "" : "s"}` }),
  );
  const sent = new Map((await firestore().collection("disputes").where("standId", "==", standId).get()).docs.map((d) => [d.id, d.data()]));
  const out: StandDispute[] = [];
  for (const summary of disputes) {
    const { dispute } = await getDispute(summary.dispute_id);
    const captureId = captureOf(dispute);
    const record = captureId ? await recordFor(captureId) : undefined;
    if (!record || record.sale.standId !== standId) continue;
    out.push({ dispute, pack: await packFor(dispute, record), countId: record.basket?.countId, evidenceSentAt: sent.get(dispute.dispute_id)?.evidenceSentAt as string | undefined });
  }
  return out;
}

async function standDispute(disputeId: string, standId: string) {
  const { dispute } = await getDispute(disputeId);
  const captureId = captureOf(dispute);
  const record = captureId ? await recordFor(captureId) : undefined;
  if (!record || record.sale.standId !== standId) throw new DisputeError("no such dispute at your stand", 404);
  return { dispute, record };
}

/** Sends the evidence pack to PayPal: code's notes, and the basket photo if the stand still holds it. */
export async function sendEvidence(disputeId: string, standId: string): Promise<{ type: string; withPhoto: boolean }> {
  const { dispute, record } = await standDispute(disputeId, standId);
  if (!canDo(dispute, "provide_evidence")) throw new DisputeError("PayPal is not asking for evidence on this dispute right now", 409);
  const pack = await packFor(dispute, record);
  const photo = record.basket ? await readPhoto(record.basket.photo).catch(() => undefined) : undefined;
  const type = evidenceType(requestedFromSeller(dispute));
  const notes = evidenceNotes({ ...pack, photo: photo ? pack.photo : undefined });
  await noted(
    { standId, orderId: record.sale.orderId, who: "grower", what: `send PayPal the evidence for dispute ${disputeId} (${type}${photo ? ", with the basket photo" : ""})`, endpoint: `POST /v1/customer/disputes/${disputeId}/provide-evidence` },
    () => provideEvidence(disputeId, { type, notes }, photo),
    (r) => ({ status: r.status, debugId: r.debugId, ref: disputeId }),
  );
  await firestore().collection("disputes").doc(disputeId).set({ standId, orderId: record.sale.orderId, evidenceSentAt: new Date().toISOString(), evidenceType: type }, { merge: true });
  return { type, withPhoto: Boolean(photo) };
}

/** The grower would rather refund: PayPal closes the dispute in the customer's favour and refunds them. */
export async function refundInstead(disputeId: string, standId: string): Promise<void> {
  const { dispute, record } = await standDispute(disputeId, standId);
  if (!canDo(dispute, "accept_claim")) throw new DisputeError("PayPal does not offer to settle this dispute that way right now", 409);
  await noted(
    { standId, orderId: record.sale.orderId, who: "grower", what: `accept the customer's claim in dispute ${disputeId}: PayPal refunds them`, endpoint: `POST /v1/customer/disputes/${disputeId}/accept-claim` },
    () => acceptClaim(disputeId, "The grower has accepted your claim. PayPal will refund you."),
    (r) => ({ status: r.status, debugId: r.debugId, ref: disputeId }),
  );
}

export type SandboxAction = "ask-for-evidence" | "decide-for-stand" | "decide-for-customer";

/**
 * Sandbox only: the steps PayPal's own staff take in a real dispute, so a
 * dispute can be tried end to end from the grower's page. Offered only when
 * PayPal lists the step on the dispute.
 */
export async function sandboxDisputeStep(disputeId: string, standId: string, action: SandboxAction): Promise<void> {
  const { dispute, record } = await standDispute(disputeId, standId);
  const step = action === "ask-for-evidence" ? "require-evidence" : "adjudicate";
  if (!offersSandboxStep(dispute, step)) throw new DisputeError("PayPal does not offer that sandbox step on this dispute right now", 409);
  const what =
    action === "ask-for-evidence"
      ? `sandbox test: have PayPal ask the stand for evidence in dispute ${disputeId}`
      : `sandbox test: have PayPal decide dispute ${disputeId} for the ${action === "decide-for-stand" ? "stand" : "customer"}`;
  await noted(
    { standId, orderId: record.sale.orderId, who: "grower", what, endpoint: `POST /v1/customer/disputes/${disputeId}/${step}` },
    () => (action === "ask-for-evidence" ? requireSellerEvidence(disputeId) : adjudicate(disputeId, action === "decide-for-stand" ? "SELLER_FAVOR" : "BUYER_FAVOR")),
    (r) => ({ status: r.status, debugId: r.debugId, ref: disputeId }),
  );
}

/**
 * A verified CUSTOMER.DISPUTE.* webhook: hold the basket photo while the
 * dispute is open, release it when PayPal resolves it. Applying it twice
 * changes nothing.
 */
export async function applyDisputeEvent(event: WebhookEvent): Promise<void> {
  if (!event.event_type.startsWith("CUSTOMER.DISPUTE.")) return;
  const dispute = event.resource as Dispute;
  const captureId = typeof dispute.dispute_id === "string" ? captureOf(dispute) : undefined;
  const record = captureId ? await recordFor(captureId) : undefined;
  if (!record) return; // not a payment made at a Strawbank stand
  const resolved = event.event_type === "CUSTOMER.DISPUTE.RESOLVED" || dispute.status === "RESOLVED";
  if (record.basket) await holdPhoto(record.basket.photo, !resolved);
  await firestore()
    .collection("disputes")
    .doc(dispute.dispute_id)
    .set({ standId: record.sale.standId, orderId: record.sale.orderId, status: dispute.status ?? null, reason: dispute.reason ?? null, photoHeld: Boolean(record.basket) && !resolved, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
