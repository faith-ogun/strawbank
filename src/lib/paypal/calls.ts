// Every call Strawbank makes to PayPal that creates, moves or checks something,
// kept in Firestore at paypalCalls with PayPal's own answer: the endpoint, the
// HTTP status, PayPal's debug id and how long it took. The grower's pages and
// the customer's receipt show them, so anyone can see exactly what Strawbank
// asked PayPal to do, and who asked: the customer's checkout, the grower, the
// agent, or PayPal's own webhook. Noting a call never holds up or breaks the
// call itself.

import { firestore } from "../firestore";

export type PayPalCall = {
  at: string;
  standId?: string;
  orderId?: string;
  who: "customer" | "grower" | "agent" | "webhook";
  /** In plain words, for example "create the order". */
  what: string;
  /** For example "POST /v2/checkout/orders". */
  endpoint: string;
  ok: boolean;
  status?: number;
  debugId?: string;
  /** The PayPal id the call made or touched: an order, capture, refund or product. */
  ref?: string;
  ms: number;
};

const calls = () => firestore().collection("paypalCalls");

export function noteCall(call: Omit<PayPalCall, "at">): void {
  calls()
    .add({ ...call, at: new Date().toISOString() })
    .catch((error) => console.error("PayPal call not noted:", error instanceof Error ? error.message : error));
}

/** Times a call and notes it, whether it succeeds or fails. */
export async function noted<T>(
  meta: Omit<PayPalCall, "at" | "ok" | "ms" | "status" | "debugId" | "ref">,
  call: () => Promise<T>,
  read: (result: T) => Partial<Pick<PayPalCall, "status" | "debugId" | "ref" | "orderId">> = () => ({}),
): Promise<T> {
  const started = Date.now();
  try {
    const result = await call();
    noteCall({ ...meta, ok: true, ms: Date.now() - started, ...read(result) });
    return result;
  } catch (error) {
    const e = error as { status?: number; debugId?: string };
    noteCall({ ...meta, ok: false, ms: Date.now() - started, status: e.status, debugId: e.debugId });
    throw error;
  }
}

export async function callsForStand(standId: string, limit = 40): Promise<PayPalCall[]> {
  const snap = await calls().where("standId", "==", standId).get();
  return snap.docs
    .map((d) => d.data() as PayPalCall)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

export async function callsForOrder(orderId: string): Promise<PayPalCall[]> {
  const snap = await calls().where("orderId", "==", orderId).get();
  return snap.docs.map((d) => d.data() as PayPalCall).sort((a, b) => (a.at < b.at ? -1 : 1));
}
