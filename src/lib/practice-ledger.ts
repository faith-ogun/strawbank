// Practice data for the ledger: the twenty simulated days of eval E5
// (eval/truth/days, written by eval/lib/make-days.ts with a fixed seed), put
// through the same code as a real stand: buildLines and orderTotalMinor price
// each basket, paidQuantities and reconcileDay close each day, decideRefund
// routes each refund, templateExplanation words it. The ledger page says these
// days are simulated wherever they appear, and they never mix with a real
// stand's records. No PayPal call was made for them, so the call log is empty.

import day01 from "../../eval/truth/days/day-01.json";
import day02 from "../../eval/truth/days/day-02.json";
import day03 from "../../eval/truth/days/day-03.json";
import day04 from "../../eval/truth/days/day-04.json";
import day05 from "../../eval/truth/days/day-05.json";
import day06 from "../../eval/truth/days/day-06.json";
import day07 from "../../eval/truth/days/day-07.json";
import day08 from "../../eval/truth/days/day-08.json";
import day09 from "../../eval/truth/days/day-09.json";
import day10 from "../../eval/truth/days/day-10.json";
import day11 from "../../eval/truth/days/day-11.json";
import day12 from "../../eval/truth/days/day-12.json";
import day13 from "../../eval/truth/days/day-13.json";
import day14 from "../../eval/truth/days/day-14.json";
import day15 from "../../eval/truth/days/day-15.json";
import day16 from "../../eval/truth/days/day-16.json";
import day17 from "../../eval/truth/days/day-17.json";
import day18 from "../../eval/truth/days/day-18.json";
import day19 from "../../eval/truth/days/day-19.json";
import day20 from "../../eval/truth/days/day-20.json";
import { DEMO_STAND } from "./demo-stand";
import { type DayRow, type LedgerRows, type PaymentRow, type RefundRow, euros, itemDayRows, itemRows } from "./ledger-rows";
import { addMinor } from "./money";
import { type CatalogueItem, buildLines, orderTotalMinor } from "./orders";
import { type DaySale, paidQuantities, reconcileDay, templateExplanation } from "./reconcile";
import { decideRefund } from "./refunds";

type Counts = Record<string, number>;
type PracticeDay = {
  date: string;
  catalogue: CatalogueItem[];
  morning: Counts;
  restocks: Counts[];
  customers: { took: Counts; declared: Counts; payment: DaySale["payment"]; returned?: Counts }[];
  dusk: Counts;
  duskConfidence: Counts;
};

const DAYS = [day01, day02, day03, day04, day05, day06, day07, day08, day09, day10, day11, day12, day13, day14, day15, day16, day17, day18, day19, day20] as PracticeDay[];

const CONFIRMED_BY = { confirmed: "PayPal signed webhook", pending: "PayPal capture reply", unpaid: "not paid" } as const;

export function practiceLedger(): LedgerRows {
  const payments: PaymentRow[] = [];
  const refunds: RefundRow[] = [];
  const days: DayRow[] = [];
  const itemDays = DAYS.flatMap((day) => {
    const sales: DaySale[] = [];
    const listed: PaymentRow[] = [];
    let takingsMinor = 0;
    day.customers.forEach((customer, n) => {
      if (!Object.values(customer.declared).some((n) => n > 0)) return; // no checkout: walked off, or paid for nothing
      const lines = buildLines(day.catalogue, customer.declared);
      const orderId = `practice-${day.date}-${String(n + 1).padStart(2, "0")}`;
      const returnedLines = customer.returned ? buildLines(day.catalogue, customer.returned) : [];
      const refundMinor = orderTotalMinor(returnedLines);
      if (refundMinor > 0 && customer.payment === "confirmed") {
        const claimed = Object.fromEntries(lines.map((l) => [l.key, l.quantity - (customer.returned?.[l.key] ?? 0)]));
        const decision = decideRefund({
          lines,
          claimed,
          recount: customer.took,
          recountConfidence: 0.95,
          refundableMinor: orderTotalMinor(lines),
          limitMinor: DEMO_STAND.refundLimitMinor,
        });
        refunds.push({
          requestId: `${orderId}-refund`,
          date: day.date,
          orderId,
          amount: euros(refundMinor),
          status: "COMPLETED",
          decidedBy: decision.route === "agent" ? "agent" : "grower",
        });
      }
      if (customer.payment === "confirmed") takingsMinor = addMinor(takingsMinor, orderTotalMinor(lines) - refundMinor);
      sales.push({ lines: lines.map((l) => ({ key: l.key, quantity: l.quantity })), payment: customer.payment, returned: customer.returned });
      listed.push({
        orderId,
        date: day.date,
        total: euros(orderTotalMinor(lines)),
        payment: customer.payment,
        confirmedBy: CONFIRMED_BY[customer.payment],
        refunded: customer.payment === "confirmed" ? euros(refundMinor) : 0,
        captureId: "",
      });
    });

    const { paid, pending } = paidQuantities(sales);
    const items = reconcileDay(day.catalogue, {
      morning: day.morning,
      restocks: day.restocks,
      dusk: day.dusk,
      duskConfidence: day.duskConfidence,
      paid,
      pending,
    });
    days.push({
      date: day.date,
      takings: euros(takingsMinor),
      confirmedPayments: listed.filter((p) => p.payment === "confirmed").length,
      pendingPayments: listed.filter((p) => p.payment === "pending").length,
      unpaidOrders: listed.filter((p) => p.payment === "unpaid").length,
      unaccountedValue: euros(items.reduce((sum, i) => sum + (i.uncertain ? 0 : i.gapMinor), 0)),
      explanation: templateExplanation(items, "EUR"),
      explanationBy: "template",
      audit: "not checked",
      auditDifferences: 0,
    });
    payments.push(...listed);
    return itemDayRows(day.date, items);
  });

  return {
    practice: true,
    standName: "Practice stand (20 simulated days from eval E5)",
    currency: "EUR",
    items: itemRows(DAYS[0].catalogue),
    itemDays,
    days,
    payments,
    refunds,
    calls: [],
  };
}
