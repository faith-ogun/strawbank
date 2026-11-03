// F6: the rows behind the grower's ledger. Code works out every number here
// from the stand's own records (the dusk reports, the orders with PayPal's
// word on each, the refunds and the PayPal call log); AG Studio only groups,
// filters and adds up what code produced. Money is converted from minor units
// to euros here, once, for display. Nothing personal is included: no payer
// names, emails or photos, because rows can reach the ledger's AI agent.

import { DEMO_STAND } from "./demo-stand";
import { type DayRecord, standDate } from "./days";
import { paymentsForDay } from "./dusk";
import { firestore } from "./firestore";
import type { Currency } from "./money";
import type { CatalogueItem } from "./orders";
import { callsForStand } from "./paypal/calls";
import type { ItemReconciliation } from "./reconcile";
import { requestsForStand } from "./refund-store";

export type ItemRow = { key: string; item: string; unitPrice: number };

export type ItemDayRow = {
  id: string;
  date: string;
  itemKey: string;
  morning: number;
  restocked: number;
  dusk: number;
  taken: number;
  paid: number;
  /** Items taken and not paid for, on a day whose count was sure. */
  unaccounted: number;
  unaccountedValue: number;
  /** Items taken and not paid for, on a day whose count or payment was not yet sure. */
  uncertain: number;
  takenValue: number;
  paidValue: number;
  /** In words: "all paid for", "unaccounted for", "uncertain" or "paid for more than taken". */
  status: string;
};

export type DayRow = {
  date: string;
  takings: number;
  confirmedPayments: number;
  pendingPayments: number;
  unpaidOrders: number;
  unaccountedValue: number;
  explanation: string;
  /** "model, numbers checked" or "template": who wrote the dusk explanation. */
  explanationBy: string;
  audit: string;
  auditDifferences: number;
};

export type PaymentRow = {
  orderId: string;
  date: string;
  total: number;
  payment: "confirmed" | "pending" | "unpaid";
  /** Which of PayPal's answers says so. */
  confirmedBy: string;
  refunded: number;
  captureId: string;
};

export type RefundRow = {
  requestId: string;
  date: string;
  orderId: string;
  amount: number;
  status: string;
  decidedBy: string;
};

export type CallRow = {
  at: string;
  who: string;
  what: string;
  endpoint: string;
  ok: boolean;
  status: number | null;
  ms: number;
  debugId: string;
  ref: string;
};

export type LedgerRows = {
  /** True for the E5 practice days, which are simulated and say so on screen. */
  practice: boolean;
  standName: string;
  currency: Currency;
  items: ItemRow[];
  itemDays: ItemDayRow[];
  days: DayRow[];
  payments: PaymentRow[];
  refunds: RefundRow[];
  calls: CallRow[];
};

export const euros = (minor: number) => minor / 100;

const CONFIRMED_BY: Record<string, string> = {
  webhook: "PayPal signed webhook",
  capture: "PayPal capture reply",
  none: "not paid",
};

export function itemDayRows(date: string, items: ItemReconciliation[]): ItemDayRow[] {
  return items.map((i) => {
    const short = Math.max(0, i.gap);
    const status = i.gap < 0 ? "paid for more than taken" : short === 0 ? "all paid for" : i.uncertain ? "uncertain" : "unaccounted for";
    return {
      id: `${date}/${i.key}`,
      date,
      itemKey: i.key,
      morning: i.morning,
      restocked: i.restocked,
      dusk: i.dusk,
      taken: i.taken,
      paid: i.paid,
      unaccounted: i.uncertain ? 0 : short,
      unaccountedValue: i.uncertain ? 0 : euros(i.gapMinor),
      uncertain: i.uncertain ? short : 0,
      takenValue: euros(i.unitMinor * Math.max(0, i.taken)),
      paidValue: euros(i.unitMinor * i.paid),
      status,
    };
  });
}

export function itemRows(catalogue: CatalogueItem[]): ItemRow[] {
  return catalogue.map((i) => ({ key: i.key, item: i.name.replace(/, each$|, jar$/i, ""), unitPrice: euros(i.unitMinor) }));
}

const DAYS_BACK = 90;

/** The ledger of a real stand, from its own Firestore records. */
export async function standLedger(standId: string, catalogue: CatalogueItem[], now = new Date()): Promise<LedgerRows> {
  const store = firestore();
  const since = standDate(new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000));
  const [daySnap, orderSnap, requests, calls] = await Promise.all([
    store.collection("stands").doc(standId).collection("days").get(),
    store.collection("orders").where("standId", "==", standId).get(),
    requestsForStand(standId),
    callsForStand(standId, 500),
  ]);

  const records = daySnap.docs.filter((d) => d.id >= since).map((d) => ({ date: d.id, ...(d.data() as DayRecord) }));
  const orderDates = [...new Set(orderSnap.docs.map((d) => String(d.data().date)).filter((d) => d >= since))];
  const byDate = new Map(await Promise.all(orderDates.map(async (date) => [date, (await paymentsForDay(standId, date)).payments] as const)));

  const payments: PaymentRow[] = [...byDate.entries()].flatMap(([date, list]) =>
    list.map((p) => ({
      orderId: p.orderId,
      date,
      total: euros(p.totalMinor),
      payment: p.payment,
      confirmedBy: CONFIRMED_BY[p.source],
      refunded: euros(p.refundedMinor),
      captureId: p.captureId ?? "",
    })),
  );

  const dates = [...new Set([...records.map((r) => r.date), ...orderDates])].sort();
  const days: DayRow[] = dates.map((date) => {
    const record = records.find((r) => r.date === date);
    const list = byDate.get(date) ?? [];
    const dusk = record?.dusk;
    return {
      date,
      takings: dusk ? euros(dusk.takingsMinor) : 0,
      confirmedPayments: list.filter((p) => p.payment === "confirmed").length,
      pendingPayments: list.filter((p) => p.payment === "pending").length,
      unpaidOrders: list.filter((p) => p.payment === "unpaid").length,
      unaccountedValue: dusk ? euros(dusk.items.reduce((sum, i) => sum + (i.uncertain ? 0 : i.gapMinor), 0)) : 0,
      explanation: dusk?.explanation.text ?? (record?.morning ? "The stand is open; the dusk count has not been done." : ""),
      explanationBy: dusk ? (dusk.explanation.source === "model" ? "model, numbers checked" : "template") : "",
      audit: record?.audit ? (record.audit.agree ? "agrees" : "differences") : "not checked",
      auditDifferences: record?.audit?.differences.length ?? 0,
    };
  });

  return {
    practice: false,
    standName: DEMO_STAND.id === standId ? DEMO_STAND.name : standId,
    currency: "EUR",
    items: itemRows(catalogue),
    itemDays: records.flatMap((r) => (r.dusk ? itemDayRows(r.date, r.dusk.items) : [])),
    days,
    payments,
    refunds: requests
      .filter((r) => r.status !== "NONE")
      .map((r) => ({
        requestId: r.requestId,
        date: r.date,
        orderId: r.orderId,
        amount: euros(r.amountMinor),
        status: r.status,
        decidedBy: r.decidedBy ?? (r.status === "WAITING" ? "waiting for the grower" : r.route),
      })),
    calls: calls.map((c) => ({
      at: c.at,
      who: c.who,
      what: c.what,
      endpoint: c.endpoint,
      ok: c.ok,
      status: c.status ?? null,
      ms: c.ms,
      debugId: c.debugId ?? "",
      ref: c.ref ?? "",
    })),
  };
}
