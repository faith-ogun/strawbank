// The ledger as AG Studio sees it: six tables from src/lib/ledger-rows.ts, how
// they join, one shared calendar, and the descriptions Studio's AI agents read.
// Studio's engine groups and sums these rows; it never works out a payment,
// a refund or a gap itself. Each fact table keeps its own grain (one row per
// item per day, per order, per refund, per PayPal call), joined only through
// the calendar and the items table, so no sum is counted twice.

import type { AgDataSourcesDefinition, AgFieldDefinition, AgReportState } from "ag-studio";
import type { LedgerRows } from "@/lib/ledger-rows";
import type { LedgerRegistry } from "./paid-taken-widget";

const money = { format: "currencyFormat", formatOptions: { format: "€#,##0.00" } } as const;
const int = { format: "integerFormat" } as const;
const text = { format: "textFormat" } as const;
const date = { format: "dateFormat", formatOptions: { format: "ddd dd mmm" } } as const;

const f = (id: string, name: string, kind: Partial<AgFieldDefinition>, description?: string): AgFieldDefinition =>
  ({ id, name, ...kind, ...(description && { description }) }) as AgFieldDefinition;

export function ledgerData(rows: LedgerRows): AgDataSourcesDefinition<LedgerRegistry> {
  const dates = rows.days.map((d) => d.date).sort();
  const from = dates[0] ?? "2026-11-01";
  const to = dates.at(-1) ?? from;
  return {
    description:
      `The ledger of one unstaffed farm stand (${rows.standName}), in euros. ` +
      "Customers take goods and pay through PayPal; at dusk the grower counts the shelf. " +
      "Taken = morning count + restocks - dusk count. A gap (taken minus paid for) is never evidence of theft: call it 'unaccounted for'. " +
      "When the count or a payment was not sure, the gap is 'uncertain' and is not counted as unaccounted for. " +
      "Payments are confirmed by PayPal's own signed webhook or capture reply, never by Strawbank. " +
      (rows.practice ? "These are 20 simulated practice days from Strawbank's eval E5, not real sales." : "These are the stand's real records in PayPal's sandbox."),
    sources: [
      {
        id: "items",
        name: "Items",
        description: "The goods on the stand, with today's price each.",
        data: rows.items,
        fields: [f("key", "Item key", { ...text, hide: true }), f("item", "Item", text), f("unitPrice", "Price each", money)],
      },
      {
        id: "itemDays",
        name: "Item days",
        description: "One row per item per closed day: the dusk reconciliation code worked out.",
        data: rows.itemDays,
        fields: [
          f("id", "Row", { ...text, hide: true }),
          f("date", "Date", date),
          f("itemKey", "Item key", { ...text, hide: true }),
          f("morning", "Morning count", int),
          f("restocked", "Restocked", int),
          f("dusk", "Dusk count", int),
          f("taken", "Taken", int, "Items taken off the shelf: morning + restocks - dusk."),
          f("paid", "Paid for", int, "Items in payments PayPal confirmed, less items refunded."),
          f("unaccounted", "Unaccounted for", int, "Taken and not paid for, on a sure count. Never call it theft."),
          f("unaccountedValue", "Unaccounted for (€)", money),
          f("uncertain", "Uncertain", int, "Taken and not paid for, where the count or a payment was not sure yet."),
          f("takenValue", "Taken (€)", money),
          f("paidValue", "Paid for (€)", money),
          f("status", "Status", text),
        ],
      },
      {
        id: "days",
        name: "Days",
        description: "One row per day the stand opened: takings, PayPal's word on the payments, the dusk explanation and the next-morning audit.",
        data: rows.days,
        fields: [
          f("date", "Date", date),
          f("takings", "Takings", money, "Payments PayPal confirmed, less refunds."),
          f("confirmedPayments", "Payments confirmed", int),
          f("pendingPayments", "Payments pending", int),
          f("unpaidOrders", "Orders not paid", int),
          f("unaccountedValue", "Unaccounted for (€)", money),
          f("explanation", "Dusk explanation", text),
          f("explanationBy", "Written by", text, "'model, numbers checked' when every number in the AI's words matched code's numbers; otherwise code's template."),
          f("audit", "Audit", text, "Whether PayPal's Transaction Search agreed with the ledger next morning."),
          f("auditDifferences", "Audit differences", int),
        ],
      },
      {
        id: "payments",
        name: "Payments",
        description: "One row per order made at the stand page, with PayPal's word on it.",
        data: rows.payments,
        fields: [
          f("orderId", "PayPal order", text),
          f("date", "Date", date),
          f("total", "Total", money),
          f("payment", "Payment", text),
          f("confirmedBy", "Confirmed by", text),
          f("refunded", "Refunded", money),
          f("captureId", "PayPal capture", text),
        ],
      },
      {
        id: "refunds",
        name: "Refunds",
        description: "One row per refund a customer asked for at the stand, and who decided it: the agent within the grower's limit, or the grower.",
        data: rows.refunds,
        fields: [
          f("requestId", "Request", { ...text, hide: true }),
          f("date", "Date", date),
          f("orderId", "PayPal order", text),
          f("amount", "Amount", money),
          f("status", "Status", text),
          f("decidedBy", "Decided by", text),
        ],
      },
      {
        id: "calls",
        name: "PayPal calls",
        description: "Every call Strawbank made to PayPal for this stand, with PayPal's debug id.",
        data: rows.calls,
        fields: [
          f("at", "Time", { format: "dateTimeFormat", formatOptions: { format: "dd mmm, hh:mm" } }),
          f("who", "Asked by", text),
          f("what", "What", text),
          f("endpoint", "Endpoint", text),
          f("ok", "Succeeded", { format: "booleanFormat" }),
          f("status", "HTTP status", int),
          f("ms", "Took (ms)", int),
          f("debugId", "PayPal debug id", text),
          f("ref", "PayPal id", text),
        ],
      },
    ],
    relationships: [
      { id: "itemday-item", source: { tableId: "itemDays", fieldId: "itemKey" }, target: { tableId: "items", fieldId: "key" }, type: "many-to-one" },
      { id: "itemdays-calendar", source: { tableId: "itemDays", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "days-calendar", source: { tableId: "days", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "payments-calendar", source: { tableId: "payments", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "refunds-calendar", source: { tableId: "refunds", fieldId: "date" }, target: { calendarId: "calendar" } },
      { id: "calls-calendar", source: { tableId: "calls", fieldId: "at" }, target: { calendarId: "calendar" }, truncate: "day" },
    ],
    calendars: [
      {
        id: "calendar",
        label: "Calendar",
        range: { from: { type: "date", value: from }, to: { type: "date", value: to } },
        fragments: ["week", { unit: "day", format: "ddd dd mmm" }, "dayOfWeek", "month"],
      },
    ],
    expressions: [
      {
        id: "honestyRate",
        name: "Paid-for rate",
        description: "Items paid for as a share of items taken. Can pass 100% when customers paid for more than they took.",
        isMeasure: true,
        format: "percentageFormat",
        formatOptions: { format: "0%" },
        expression: { operator: "divide", inputs: [{ id: "itemDays.paid", aggregation: "sum" }, { id: "itemDays.taken", aggregation: "sum" }] },
      },
    ],
  } as AgDataSourcesDefinition<LedgerRegistry>;
}

const title = (text: string) => ({ title: { enabled: true, text } });
const caption = (text: string) => ({ caption: { enabled: true, text } });

/** The pre-built report: a page per question the grower asks. */
export const ledgerReport: AgReportState<LedgerRegistry> = {
  selectedPageId: "stand",
  panels: { filters: { collapsed: true }, data: { collapsed: true } },
  pages: [
    {
      id: "stand",
      widgets: {
        takings: { type: "value", dataMapping: { value: [{ id: "days.takings", aggregation: "sum" }] }, format: caption("Takings PayPal confirmed") },
        confirmed: { type: "value", dataMapping: { value: [{ id: "days.confirmedPayments", aggregation: "sum" }] }, format: caption("Payments confirmed by PayPal") },
        rate: { type: "value", dataMapping: { value: [{ id: "honestyRate" }] }, format: caption("Paid for, of what was taken") },
        unaccounted: { type: "value", dataMapping: { value: [{ id: "itemDays.unaccountedValue", aggregation: "sum" }] }, format: caption("Unaccounted for") },
        shelf: {
          type: "paid-taken",
          dataMapping: {
            item: [{ id: "items.item" }],
            taken: [{ id: "itemDays.taken", aggregation: "sum" }],
            paid: [{ id: "itemDays.paid", aggregation: "sum" }],
            unaccounted: [{ id: "itemDays.unaccounted", aggregation: "sum" }],
            uncertain: [{ id: "itemDays.uncertain", aggregation: "sum" }],
          },
          format: title("Paid for versus taken, by item"),
        },
        weekday: {
          type: "column-chart-stacked-100",
          dataMapping: {
            categoryKey: [{ id: "calendar::dayOfWeek" }],
            valueKey: [
              { id: "itemDays.paid", aggregation: "sum" },
              { id: "itemDays.unaccounted", aggregation: "sum" },
              { id: "itemDays.uncertain", aggregation: "sum" },
            ],
            tooltipKey: [],
          },
          format: title("Share paid for, by day of the week"),
        },
        byDay: {
          type: "column-chart-stacked",
          dataMapping: {
            categoryKey: [{ id: "calendar::day" }],
            valueKey: [
              { id: "itemDays.paid", aggregation: "sum" },
              { id: "itemDays.unaccounted", aggregation: "sum" },
              { id: "itemDays.uncertain", aggregation: "sum" },
            ],
            tooltipKey: [],
          },
          format: title("Items each day: paid for, unaccounted for, uncertain"),
        },
        days: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "days.date" },
              { id: "days.takings" },
              { id: "days.confirmedPayments" },
              { id: "days.pendingPayments" },
              { id: "days.explanation" },
              { id: "days.explanationBy" },
              { id: "days.audit" },
            ],
          },
          sort: [{ field: { id: "days.date" }, direction: "desc" }],
          format: title("Each day, in the stand's own words"),
        },
      },
      widgetLayout: {
        takings: { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 5 },
        confirmed: { xTrack: 6, yTrack: 0, xSpan: 6, ySpan: 5 },
        rate: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 5 },
        unaccounted: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 5 },
        shelf: { xTrack: 0, yTrack: 5, xSpan: 12, ySpan: 18 },
        weekday: { xTrack: 12, yTrack: 5, xSpan: 12, ySpan: 18 },
        byDay: { xTrack: 0, yTrack: 23, xSpan: 24, ySpan: 14 },
        days: { xTrack: 0, yTrack: 37, xSpan: 24, ySpan: 16 },
      },
    },
    {
      id: "payments",
      widgets: {
        status: { type: "button-filter", dataMapping: { value: [{ id: "payments.payment" }] }, format: title("PayPal's word") },
        total: { type: "value", dataMapping: { value: [{ id: "payments.total", aggregation: "sum" }] }, format: caption("Order totals") },
        refunded: { type: "value", dataMapping: { value: [{ id: "payments.refunded", aggregation: "sum" }] }, format: caption("Refunded") },
        source: {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "payments.confirmedBy" }], valueKey: [{ id: "payments.orderId", aggregation: "countd" }], tooltipKey: [] },
          format: title("Who confirmed each payment"),
        },
        list: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "payments.date" },
              { id: "payments.orderId" },
              { id: "payments.total" },
              { id: "payments.payment" },
              { id: "payments.confirmedBy" },
              { id: "payments.refunded" },
              { id: "payments.captureId" },
            ],
          },
          sort: [{ field: { id: "payments.date" }, direction: "desc" }],
          format: title("Every order, with PayPal's ids"),
        },
      },
      widgetLayout: {
        status: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 7 },
        total: { xTrack: 12, yTrack: 0, xSpan: 6, ySpan: 7 },
        refunded: { xTrack: 18, yTrack: 0, xSpan: 6, ySpan: 7 },
        source: { xTrack: 0, yTrack: 7, xSpan: 8, ySpan: 18 },
        list: { xTrack: 8, yTrack: 7, xSpan: 16, ySpan: 18 },
      },
    },
    {
      id: "refunds",
      widgets: {
        amount: { type: "value", dataMapping: { value: [{ id: "refunds.amount", aggregation: "sum" }] }, format: caption("Refunded or asked for") },
        count: { type: "value", dataMapping: { value: [{ id: "refunds.requestId", aggregation: "countd" }] }, format: caption("Refund requests") },
        who: {
          type: "donut-chart",
          dataMapping: { categoryKey: [{ id: "refunds.decidedBy" }], valueKey: [{ id: "refunds.amount", aggregation: "sum" }], tooltipKey: [] },
          format: title("Who decided: the agent within your limit, or you"),
        },
        list: {
          type: "grid",
          dataMapping: {
            cols: [{ id: "refunds.date" }, { id: "refunds.orderId" }, { id: "refunds.amount" }, { id: "refunds.status" }, { id: "refunds.decidedBy" }],
          },
          sort: [{ field: { id: "refunds.date" }, direction: "desc" }],
          format: title("Every refund"),
        },
      },
      widgetLayout: {
        amount: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 5 },
        count: { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 5 },
        who: { xTrack: 0, yTrack: 5, xSpan: 10, ySpan: 16 },
        list: { xTrack: 10, yTrack: 5, xSpan: 14, ySpan: 16 },
      },
    },
    {
      id: "calls",
      widgets: {
        count: { type: "value", dataMapping: { value: [{ id: "calls.debugId", aggregation: "count" }] }, format: caption("Calls to PayPal") },
        speed: { type: "value", dataMapping: { value: [{ id: "calls.ms", aggregation: "avg" }] }, format: caption("Average time (ms)") },
        endpoints: {
          type: "bar-chart-grouped",
          dataMapping: { categoryKey: [{ id: "calls.endpoint" }], valueKey: [{ id: "calls.ms", aggregation: "count" }], tooltipKey: [] },
          format: title("Calls by PayPal endpoint"),
        },
        list: {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "calls.at" },
              { id: "calls.who" },
              { id: "calls.what" },
              { id: "calls.endpoint" },
              { id: "calls.status" },
              { id: "calls.ms" },
              { id: "calls.debugId" },
              { id: "calls.ref" },
            ],
          },
          sort: [{ field: { id: "calls.at" }, direction: "desc" }],
          format: title("What Strawbank asked PayPal, with PayPal's debug ids"),
        },
      },
      widgetLayout: {
        count: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 5 },
        speed: { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 5 },
        endpoints: { xTrack: 0, yTrack: 5, xSpan: 24, ySpan: 12 },
        list: { xTrack: 0, yTrack: 17, xSpan: 24, ySpan: 18 },
      },
    },
  ],
} as AgReportState<LedgerRegistry>;

/** The report's pages, in the order the ledger's tabs show them. */
export const LEDGER_PAGES = [
  { id: "stand", label: "What walked" },
  { id: "payments", label: "Payments" },
  { id: "refunds", label: "Refunds" },
  { id: "calls", label: "PayPal calls" },
] as const;
