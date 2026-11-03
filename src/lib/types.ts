// The data model, first cut (spec section 8). Money is always in minor units.

import type { Currency } from "./money";
import type { CatalogueItem, OrderLine } from "./orders";
import type { ItemReconciliation } from "./reconcile";
import type { RefundRecord } from "./refunds";

export type Stand = {
  id: string;
  name: string;
  grower: string;
  currency: Currency;
  /** The most the agent may refund on its own, per request. */
  refundLimitMinor: number;
  /** Where the stand is: PayPal records each order as collected here. */
  place: { line1: string; town: string; country: string };
};

export type Day = {
  standId: string;
  date: string;
  catalogue: CatalogueItem[];
  state: "setting-up" | "open" | "reconciled" | "audited";
};

export type StockSnapshot = {
  standId: string;
  date: string;
  kind: "morning" | "restock" | "dusk";
  photoRef: string;
  counts: Record<string, number>;
  confidence: Record<string, number>;
  confirmedBy?: "grower";
};

export type Order = {
  standId: string;
  date: string;
  paypalOrderId: string;
  lines: OrderLine[];
  totalMinor: number;
  basketPhotoRef: string;
  status: "CREATED" | "APPROVED" | "COMPLETED" | "CANCELLED";
};

export type Capture = {
  paypalOrderId: string;
  paypalCaptureId: string;
  amountMinor: number;
  time: string;
};

export type Refund = RefundRecord & { reason: string };

export type Reconciliation = {
  standId: string;
  date: string;
  items: ItemReconciliation[];
  explanation: { text: string; source: "model" | "template" };
  audit?: { checkedAt: string; differences: string[] };
};

/** Append-only log of every model call, tool call and money movement. */
export type LogEvent = {
  at: string;
  kind: "model" | "tool" | "money" | "webhook";
  summary: string;
  data?: unknown;
};
