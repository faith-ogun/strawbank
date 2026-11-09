// F4 end to end. A customer says what they really took; the agent recounts
// their stored basket photo on the careful model; code decides the amount and
// who settles it (decideRefund, eval E4.2); the agent refunds through the
// Agent Toolkit only when code says it may, at most once per request (eval
// E4.3). Everything else waits for the grower, with the photo held as evidence.
// Every word the customer reads here is written by code, not the model.

import { createHash } from "node:crypto";
import { countBasket } from "./ai/count";
import { findStand } from "./demo-stand";
import { readMorning } from "./days";
import { firestore } from "./firestore";
import type { LedgerCapture } from "./ledger";
import { formatMoney } from "./money";
import { noteCall } from "./paypal/calls";
import { ToolkitRefundGateway } from "./paypal/refunds";
import { holdPhoto, readPhoto } from "./photos";
import { type RefundRequest, firestoreRefundStore, readRequest, refundableNow, saveRequest, updateRequest } from "./refund-store";
import { type RefundOutcome, decideRefund, issueRefund } from "./refunds";
import { readBasket, readSale } from "./sales";

export class RefundClaimError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const REASONS: Record<string, string> = {
  "the photo does not support the claim": "the basket photo seems to show more than you say you took",
  "the recount is uncertain": "the basket photo is not clear enough for the agent to be sure",
  "over the grower's limit": "it is more than the agent may refund on its own",
  "earlier refunds leave less than the claim": "earlier refunds leave less than you asked for",
  "no basket photo to recount": "there is no basket photo to check",
  "the recount did not work": "the agent could not recount the basket photo just now",
  "the basket photo looks like an earlier sale's": "the basket photo looks like one used for an earlier sale",
};

async function captureFor(orderId: string, known?: string): Promise<LedgerCapture | undefined> {
  const store = firestore();
  if (known) {
    const capture = (await store.collection("ledgerCaptures").doc(known).get()).data() as LedgerCapture | undefined;
    if (capture) return capture;
  }
  const snap = await store.collection("ledgerCaptures").where("orderId", "==", orderId).limit(1).get();
  return snap.docs[0]?.data() as LedgerCapture | undefined;
}

/** The same claim on the same order is the same request, so pressing twice never refunds twice. */
function requestIdFor(orderId: string, claimed: Record<string, number>): string {
  const sorted = Object.keys(claimed).sort().map((k) => `${k}=${claimed[k]}`).join(",");
  return createHash("sha256").update(`${orderId}|${sorted}`).digest("hex").slice(0, 32);
}

/** What the customer reads about a request, in code's words. */
export function requestMessage(request: RefundRequest): string {
  const amount = formatMoney(request.amountMinor, request.currency);
  switch (request.status) {
    case "COMPLETED":
      return request.decidedBy === "agent"
        ? `The stand's agent recounted your basket photo and agrees. ${amount} has been refunded to your PayPal account.`
        : `The grower agreed. ${amount} has been refunded to your PayPal account.`;
    case "PENDING":
      return `A refund of ${amount} has been sent to PayPal and is on its way.`;
    case "WAITING":
      return `The grower will look at this, because ${request.reasons.map((r) => REASONS[r] ?? r).join(", and ")}. The answer will show on this receipt.`;
    case "DECLINED":
      return "The grower looked at your basket photo and did not refund this. If you think that is wrong, you can still contact PayPal.";
    case "FAILED":
      return "PayPal did not accept the refund. The grower has been told.";
    default:
      return request.reasons.map((r) => REASONS[r] ?? r).join(". ");
  }
}

/** Issues the refund code approved, and notes the call for the grower's and customer's pages. */
async function refundAndNote(request: RefundRequest, decidedBy: "agent" | "grower", amountMinor: number): Promise<RefundOutcome> {
  const started = Date.now();
  const outcome = await issueRefund(firestoreRefundStore, new ToolkitRefundGateway(), {
    requestId: request.requestId,
    captureId: request.captureId,
    amountMinor,
    currency: request.currency,
    decidedBy,
  });
  if (outcome.kind !== "over" && outcome.kind !== "duplicate") {
    noteCall({
      standId: request.standId,
      orderId: request.orderId,
      who: decidedBy,
      what: `refund ${formatMoney(amountMinor, request.currency)} (Agent Toolkit create_refund)`,
      endpoint: `POST /v2/payments/captures/${request.captureId}/refund`,
      ok: outcome.kind === "refunded",
      ref: outcome.record.paypalRefundId,
      ms: Date.now() - started,
    });
  }
  return outcome;
}

function settled(request: RefundRequest, outcome: RefundOutcome): RefundRequest {
  if (outcome.kind === "over") return { ...request, status: "NONE", reasons: ["nothing left to refund on this payment"] };
  return { ...request, status: outcome.record.status, refund: outcome.record };
}

export async function claimRefund(orderId: string, claimedInput: Record<string, number>): Promise<RefundRequest> {
  const sale = await readSale(orderId);
  if (!sale) throw new RefundClaimError("this order was not made at a Strawbank stand page", 404);
  const found = findStand(sale.standId);
  if (!found) throw new RefundClaimError("this stand no longer exists", 404);

  const lineKeys = new Set(sale.lines.map((l) => l.key));
  if (Object.keys(claimedInput).some((k) => !lineKeys.has(k))) throw new RefundClaimError("a claim names an item that was not in this order", 400);
  const claimed = Object.fromEntries(sale.lines.map((l) => [l.key, claimedInput[l.key] ?? l.quantity]));
  for (const line of sale.lines) {
    const n = claimed[line.key];
    if (!Number.isInteger(n) || n < 0 || n > line.quantity) throw new RefundClaimError(`you can claim between 0 and ${line.quantity} for ${line.name}`, 400);
  }

  const requestId = requestIdFor(orderId, claimed);
  const existing = await readRequest(requestId);
  if (existing) return existing;

  const capture = await captureFor(orderId, sale.captureId);
  if (!capture || capture.status !== "COMPLETED") {
    throw new RefundClaimError("PayPal has not confirmed this payment yet; try again in a minute", 409);
  }

  // The agent recounts the photo the customer took at the stand, on the careful model.
  const basket = sale.countId ? await readBasket(sale.countId) : undefined;
  let recount: Record<string, number> | undefined;
  let recountConfidence = 0;
  let recountFailed = false;
  if (basket) {
    const morning = await readMorning(sale.standId, sale.date);
    const catalogue = morning?.catalogue ?? found.catalogue;
    const looks = new Map(found.catalogue.map((i) => [i.key, i.looks]));
    // If the recount fails (the photo is gone, or Gemini does not answer), the claim waits for the grower.
    try {
      const { data, contentType } = await readPhoto(basket.photo);
      const recountOn = (speed: "careful" | "fast") =>
        countBasket({
          photo: data,
          mediaType: contentType,
          items: catalogue.map(({ key, name }) => ({ key, name, looks: looks.get(key) })),
          speed,
          thinking: "low",
        });
      // The careful model first; if it is too busy or does not answer, the fast
      // one, which counts every basket at the till (9 Nov: a 429 sent a claim to the grower).
      const count = await recountOn("careful").catch((error: unknown) => {
        console.error(`recount for ${orderId} on the careful model failed, trying the fast one:`, error instanceof Error ? error.message : error);
        return recountOn("fast");
      });
      recount = count.counts;
      const disputed = sale.lines.filter((l) => claimed[l.key] < l.quantity);
      recountConfidence = Math.min(...disputed.map((l) => count.confidence[l.key] ?? 0));
    } catch (error) {
      console.error(`recount for ${orderId} failed:`, error instanceof Error ? error.message : error);
      recountFailed = true;
    }
  }

  const decision = decideRefund({
    lines: sale.lines,
    claimed,
    recount: recount ?? {},
    recountConfidence,
    refundableMinor: await refundableNow(capture.captureId),
    limitMinor: found.stand.refundLimitMinor,
    photoLooksReused: Boolean(sale.photoLooksLike),
  });
  // With no recount at all, "uncertain" only repeats that it did not happen (9 Nov: the customer read both).
  const noRecount = !basket || recountFailed;
  const reasons = decision.route === "agent" ? [] : decision.reasons.filter((r) => !(noRecount && r === "the recount is uncertain"));
  if (!basket && decision.route !== "none") reasons.unshift("no basket photo to recount");
  if (recountFailed && decision.route !== "none") reasons.unshift("the recount did not work");

  let request: RefundRequest = {
    requestId,
    orderId,
    standId: sale.standId,
    date: sale.date,
    captureId: capture.captureId,
    currency: sale.currency,
    lines: sale.lines,
    claimed,
    items: Object.fromEntries(sale.lines.map((l) => [l.key, l.quantity - claimed[l.key]]).filter(([, n]) => (n as number) > 0)),
    recount,
    recountConfidence: recount ? recountConfidence : undefined,
    countId: basket?.countId,
    route: decision.route,
    reasons,
    amountMinor: decision.route === "none" ? 0 : decision.amountMinor,
    status: decision.route === "none" ? "NONE" : decision.route === "grower" ? "WAITING" : "PENDING",
    ...(decision.route === "agent" && { decidedBy: "agent" as const }),
  };
  await saveRequest(request);

  if (decision.route === "grower" && basket) await holdPhoto(basket.photo, true).catch(() => undefined);
  if (decision.route !== "agent") return request;

  const outcome = await refundAndNote(request, "agent", decision.amountMinor);
  request = settled(request, outcome);
  if (outcome.kind === "over") await updateRequest(requestId, { status: request.status, reasons: request.reasons });
  return request;
}

/** The grower's answer to a request that waited for them. */
export async function growerDecides(requestId: string, standId: string, action: "refund" | "decline"): Promise<RefundRequest> {
  const request = await readRequest(requestId);
  if (!request || request.standId !== standId) throw new RefundClaimError("no such request at your stand", 404);
  if (request.status !== "WAITING") throw new RefundClaimError("this request is already settled", 409);
  const basket = request.countId ? await readBasket(request.countId) : undefined;
  if (basket) await holdPhoto(basket.photo, false).catch(() => undefined);

  if (action === "decline") {
    await updateRequest(requestId, { status: "DECLINED", decidedBy: "grower" });
    return { ...request, status: "DECLINED", decidedBy: "grower" };
  }
  const outcome = await refundAndNote(request, "grower", request.amountMinor);
  const next = settled({ ...request, decidedBy: "grower" }, outcome);
  if (outcome.kind === "over") await updateRequest(requestId, { status: next.status, reasons: next.reasons, decidedBy: "grower" });
  return next;
}
