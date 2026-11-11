// Dispute evidence from the stand's own record. When a customer disputes a
// payment with PayPal ("I never got it", "not as described"), the grower
// answers with what the stand already holds: the basket photo the customer
// took at the stand when they paid, the count they confirmed, what PayPal
// itself recorded (the order collected at the stand, the capture, its signed
// webhook) and any refund already made. Every word is written by code from
// that record; the model writes none of it (hard rule 3, eval E4.13).

import { type Currency, formatMoney } from "./money";
import type { OrderLine } from "./orders";

export type EvidencePack = {
  disputeId: string;
  standName: string;
  orderId: string;
  captureId: string;
  /** When PayPal captured the payment (ISO), if known. */
  capturedAt?: string;
  date: string;
  lines: OrderLine[];
  /** What PayPal captured, in minor units. */
  capturedMinor: number;
  currency: Currency;
  /** True when PayPal's signed webhook confirmed the capture, not only its reply to our server. */
  confirmedByWebhook: boolean;
  /** True when the order told PayPal the goods were collected at the stand. */
  collectedAtStand: boolean;
  /** The customer's basket photo, if the stand still holds it (photos are deleted after 30 days). */
  photo?: { taken: string };
  /** Refunds already made on this payment through Strawbank. */
  refundedMinor: number;
};

/** PayPal's notes field takes at most 2,000 characters. */
export const NOTES_MAX = 2000;

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" }).format(new Date(iso));

/** The notes PayPal's reviewer reads, built only from the record. */
export function evidenceNotes(pack: EvidencePack): string {
  const money = (minor: number) => formatMoney(minor, pack.currency);
  const lines = pack.lines.map((l) => `${l.quantity} x ${l.name.replace(/, (each|jar)$/i, "")} at ${money(l.unitMinor)}`).join("; ");
  const parts = [
    `${pack.standName} is an unstaffed farm stand. Customers take goods from the shelf themselves and pay on their own phone.`,
    `PayPal order ${pack.orderId}, capture ${pack.captureId}${pack.capturedAt ? `, paid ${when(pack.capturedAt)}` : `, ${pack.date}`}: ${lines}. PayPal captured ${money(pack.capturedMinor)}.`,
    pack.collectedAtStand ? "The order recorded with PayPal says the goods were collected at the stand (in-store pickup)." : "",
    pack.photo
      ? `Attached: the photo of the basket the customer took at the stand before paying (${when(pack.photo.taken)}). The customer confirmed the count of every item before paying and could change any of them.`
      : "The customer confirmed the count of every item before paying. The basket photo is no longer held: the stand deletes photos after 30 days, as it tells customers.",
    pack.confirmedByWebhook ? "PayPal's own signed webhook confirmed the payment." : "",
    pack.refundedMinor > 0 ? `Already refunded through PayPal for this payment: ${money(pack.refundedMinor)}.` : "",
  ].filter(Boolean);
  const text = parts.join(" ");
  return text.length <= NOTES_MAX ? text : `${text.slice(0, NOTES_MAX - 1)}…`;
}

/**
 * The evidence type to send: one PayPal asked the seller for, because PayPal refuses any other
 * (11 Nov, the first real sandbox dispute: EVIDENCE_TYPE_IS_NOT_ALLOWED). Proof of fulfilment is
 * sent as the stand's notes and the basket photo, never with a tracking number: the goods were
 * collected at the stand, and PayPal takes that type with notes or a document. Refund or return
 * proof is never claimed. With nothing asked for, a description of the purchase.
 */
export function evidenceType(requested: string[]): string {
  const preferred = ["PROOF_OF_INSTORE_RECEIPT", "PROOF_OF_FULFILLMENT", "DETAILS_OF_PURCHASE", "RECEIPT_OF_MERCHANDISE", "OTHER"];
  const usable = requested.filter((t) => !["PROOF_OF_REFUND", "PROOF_OF_RETURN"].includes(t));
  return preferred.find((t) => usable.includes(t)) ?? usable[0] ?? "DETAILS_OF_PURCHASE";
}
