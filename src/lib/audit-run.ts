// F5 run: the ledger's entries for one stand's day, PayPal's Transaction Search
// around that day, compared by auditDay and kept on the day's record.

import { type AuditResult, auditDay } from "./audit";
import { type Audit, saveAudit } from "./days";
import { whereIn } from "./firestore";
import type { LedgerCapture, LedgerRefund } from "./ledger";
import type { Currency } from "./money";
import { noted } from "./paypal/calls";
import { searchTransactions } from "./paypal/transactions";
import { daySales } from "./sales";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runAudit(standId: string, date: string, currency: Currency): Promise<Audit> {
  const sales = await daySales(standId, date);
  const byOrder = await whereIn<LedgerCapture>("ledgerCaptures", "orderId", sales.map((s) => s.orderId));
  const captures = [...new Map(byOrder.map((c) => [c.captureId, c])).values()];
  const refunds = await whereIn<LedgerRefund>("ledgerRefunds", "captureId", captures.map((c) => c.captureId));

  // A window around the Irish day; payments are picked out by their custom_id, refunds by the payment they refund.
  const dayStart = new Date(`${date}T00:00:00Z`).getTime();
  const to = new Date(Math.min(Date.now(), dayStart + 2 * DAY_MS));
  const transactions = await noted(
    { standId, who: "grower", what: `check ${date} against PayPal's Transaction Search`, endpoint: "GET /v1/reporting/transactions" },
    () => searchTransactions(new Date(dayStart - DAY_MS), to),
    (t) => ({ status: 200, debugId: t.debugId }),
  );
  const result: AuditResult = auditDay({ standId, date, currency, captures, refunds, transactions });
  const audit: Audit = { ...result, checkedAt: new Date().toISOString() };
  await saveAudit(standId, date, audit);
  return audit;
}
