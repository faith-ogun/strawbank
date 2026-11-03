// The IOU end to end. The customer leaves an email address; code prices the
// counted basket and PayPal invoices it (src/lib/paypal/invoices.ts, eval
// E4.10). The invoice is sent only if PayPal's total is code's total to the
// cent; otherwise the draft is deleted. PayPal's signed webhook marks it paid;
// the grower can remind, record cash, or cancel. Each IOU is kept in
// Firestore at ious/{invoiceId}, with the address masked: PayPal holds it.

import { FieldValue } from "@google-cloud/firestore";
import { readBasket } from "./sales";
import { standDate, standToday } from "./days";
import { firestore } from "./firestore";
import { type InvoiceStatus, type Iou, invoiceBody, maskEmail } from "./ious";
import type { WebhookEvent } from "./ledger";
import { buildLines, orderTotalMinor } from "./orders";
import { noted } from "./paypal/calls";
import { cancelInvoice, createInvoice, deleteDraft, recordCash, remindInvoice, sendInvoice } from "./paypal/invoices";

export class IouError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const ious = () => firestore().collection("ious");

export async function readIou(invoiceId: string): Promise<Iou | undefined> {
  return (await ious().doc(invoiceId).get()).data() as Iou | undefined;
}

export async function iousForStand(standId: string): Promise<Iou[]> {
  const snap = await ious().where("standId", "==", standId).get();
  return snap.docs.map((d) => d.data() as Iou).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function iousForDay(standId: string, date: string): Promise<Iou[]> {
  const snap = await ious().where("standId", "==", standId).where("date", "==", date).get();
  return snap.docs.map((d) => d.data() as Iou);
}

export async function leaveIou(input: { standId: string; counts: Record<string, number>; countId?: string; email: string; requestId: string }): Promise<Iou> {
  const found = await standToday(input.standId);
  if (!found) throw new IouError(`no stand "${input.standId}"`, 404);
  const date = standDate();
  const basket = input.countId ? await readBasket(input.countId).catch(() => undefined) : undefined;
  const countId = basket?.standId === input.standId && basket.date === date ? basket.countId : undefined;
  const { stand } = found;
  const lines = buildLines(found.catalogue, input.counts);
  const totalMinor = orderTotalMinor(lines);
  const body = invoiceBody({ lines, currency: stand.currency, email: input.email, standName: stand.name, standId: stand.id, date });

  const draft = await noted(
    { standId: stand.id, who: "customer", what: "write the IOU as a PayPal invoice, one line per item", endpoint: "POST /v2/invoicing/invoices" },
    () => createInvoice(body, input.requestId, stand.currency),
    (d) => ({ status: 201, debugId: d.debugId, ref: d.invoiceId, orderId: d.invoiceId }),
  );
  if (draft.totalMinor !== totalMinor) {
    await deleteDraft(draft.invoiceId).catch(() => undefined);
    throw new IouError("PayPal's total did not match the stand's prices, so no invoice was sent", 502);
  }
  const sent = await noted(
    { standId: stand.id, orderId: draft.invoiceId, who: "customer", what: "send the IOU: PayPal emails the customer a link to pay", endpoint: `POST /v2/invoicing/invoices/${draft.invoiceId}/send` },
    () => sendInvoice(draft.invoiceId),
    (s) => ({ status: s.status, debugId: s.debugId, ref: draft.invoiceId }),
  );
  const iou: Iou = {
    invoiceId: draft.invoiceId,
    standId: stand.id,
    date,
    lines,
    totalMinor,
    currency: stand.currency,
    maskedEmail: maskEmail(input.email),
    status: "SENT",
    payUrl: sent.payUrl,
    countId,
    createdAt: new Date().toISOString(),
  };
  await ious().doc(iou.invoiceId).set({ ...iou, at: FieldValue.serverTimestamp() });
  return iou;
}

export type IouAction = "remind" | "cash" | "cancel";

export async function growerIouAction(invoiceId: string, standId: string, standName: string, action: IouAction): Promise<Iou> {
  const iou = await readIou(invoiceId);
  if (!iou || iou.standId !== standId) throw new IouError("no such IOU at your stand", 404);
  if (iou.status === "PAID" || iou.status === "MARKED_AS_PAID" || iou.status === "CANCELLED") throw new IouError("this IOU is already settled", 409);
  const meta = { standId, orderId: invoiceId, who: "grower" as const };
  if (action === "remind") {
    await noted({ ...meta, what: "remind the customer of the IOU", endpoint: `POST /v2/invoicing/invoices/${invoiceId}/remind` }, () => remindInvoice(invoiceId, standName), (r) => ({ status: r.status, debugId: r.debugId, ref: invoiceId }));
    await ious().doc(invoiceId).set({ remindedAt: new Date().toISOString() }, { merge: true });
    return iou;
  }
  if (action === "cash") {
    await noted(
      { ...meta, what: "record the IOU as paid in cash at the stand", endpoint: `POST /v2/invoicing/invoices/${invoiceId}/payments` },
      () => recordCash(invoiceId, iou.totalMinor, iou.currency, standDate()),
      (r) => ({ status: r.status, debugId: r.debugId, ref: r.paymentId ?? invoiceId }),
    );
    const update = { status: "MARKED_AS_PAID" as const, paidBy: "cash" as const };
    await ious().doc(invoiceId).set(update, { merge: true });
    return { ...iou, ...update };
  }
  await noted({ ...meta, what: "cancel the IOU", endpoint: `POST /v2/invoicing/invoices/${invoiceId}/cancel` }, () => cancelInvoice(invoiceId), (r) => ({ status: r.status, debugId: r.debugId, ref: invoiceId }));
  await ious().doc(invoiceId).set({ status: "CANCELLED" }, { merge: true });
  return { ...iou, status: "CANCELLED" };
}

const SETTLED: InvoiceStatus[] = ["PAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED", "MARKED_AS_REFUNDED"];

/**
 * A verified INVOICING.INVOICE.* webhook: PayPal's word on an IOU. Applying it
 * twice changes nothing, and a later "sent" or "updated" never reopens an IOU
 * PayPal already called paid or cancelled.
 */
export async function applyInvoiceEvent(event: WebhookEvent): Promise<void> {
  if (!event.event_type.startsWith("INVOICING.INVOICE.")) return;
  const invoice = (event.resource.invoice ?? event.resource) as { id?: unknown; status?: unknown };
  if (typeof invoice.id !== "string" || typeof invoice.status !== "string") return;
  const status = invoice.status as InvoiceStatus;
  const ref = ious().doc(invoice.id);
  await firestore().runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data() as Iou | undefined;
    if (!current) return; // not one of ours
    if (SETTLED.includes(current.status) && !SETTLED.includes(status)) return;
    tx.set(ref, { status, ...(status === "PAID" && { paidBy: "paypal" }), confirmedByWebhook: true, webhookAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}
