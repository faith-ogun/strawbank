// What each sale was: every basket count and every order the stand page
// creates, kept in Firestore. baskets/{countId} holds the photo's place in the
// bucket and what the model counted; orders/{orderId} holds the stand, the day,
// the lines and the count it came from. Whether an order was paid is the
// ledger's business (PayPal's signed webhooks); this says what was in it.

import { FieldValue } from "@google-cloud/firestore";
import { firestore } from "./firestore";
import type { Currency } from "./money";
import type { OrderLine } from "./orders";

export type BasketRecord = {
  countId: string;
  standId: string;
  date: string;
  /** The photo's path in the evidence bucket. */
  photo: string;
  counts: Record<string, number>;
  confidence: Record<string, number>;
};

export type Sale = {
  orderId: string;
  standId: string;
  date: string;
  lines: OrderLine[];
  totalMinor: number;
  currency: Currency;
  countId?: string;
  /** From the capture response our server received. The webhook confirms it in the ledger. */
  captureId?: string;
  captureStatus?: string;
};

const baskets = () => firestore().collection("baskets");
const orders = () => firestore().collection("orders");

export async function saveBasket(record: BasketRecord): Promise<void> {
  await baskets().doc(record.countId).set({ ...record, at: FieldValue.serverTimestamp() });
}

export async function readBasket(countId: string): Promise<BasketRecord | undefined> {
  return (await baskets().doc(countId).get()).data() as BasketRecord | undefined;
}

export async function recordSale(sale: Sale): Promise<void> {
  await orders().doc(sale.orderId).set({ ...sale, createdAt: FieldValue.serverTimestamp() });
}

export async function recordCapture(orderId: string, captureId: string, captureStatus: string): Promise<void> {
  await orders().doc(orderId).set({ captureId, captureStatus, capturedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function readSale(orderId: string): Promise<Sale | undefined> {
  return (await orders().doc(orderId).get()).data() as Sale | undefined;
}

export async function daySales(standId: string, date: string): Promise<Sale[]> {
  const snap = await orders().where("standId", "==", standId).where("date", "==", date).get();
  return snap.docs.map((d) => d.data() as Sale);
}
