import { type AuditDifference, type PayPalTransaction, auditDay } from "../src/lib/audit";
import type { LedgerCapture, LedgerRefund } from "../src/lib/ledger";
import type { Eval } from "./lib/types";

// E7. Next-morning audit. Each scenario is one stand's day as the ledger has it
// and as Transaction Search reports it, shaped like the sandbox's real replies
// (read 3 Nov: a capture's reference id is its order; a refund is a negative
// amount whose reference id is the capture). Differences are planted: a
// capture the ledger never heard of (a missed webhook and a lost capture
// reply), a refund made in PayPal outside Strawbank, an amount that differs, a
// payment PayPal does not show. Around them sit things the audit must leave
// alone: another stand's payments, another day's, untagged older ones, and a
// refund of someone else's payment. The audit must flag exactly the planted
// differences. A live run on a finished sandbox day follows once one exists.

const STAND = "demo";
const DATE = "2026-11-03";
const TAG = `${STAND}/${DATE}`;

const cap = (captureId: string, amountMinor: number, status: LedgerCapture["status"] = "COMPLETED"): LedgerCapture => ({
  captureId,
  orderId: `O-${captureId}`,
  amountMinor,
  currency: "EUR",
  status,
});
const ref = (refundId: string, captureId: string, amountMinor: number): LedgerRefund => ({ refundId, captureId, amountMinor, currency: "EUR", status: "COMPLETED" });
const pay = (id: string, amount: string, customField = TAG): PayPalTransaction => ({ transactionId: id, referenceId: `O-${id}`, amount, currency: "EUR", status: "S", customField });
const back = (id: string, captureId: string, amount: string): PayPalTransaction => ({ transactionId: id, referenceId: captureId, amount: `-${amount}`, currency: "EUR", status: "S", eventCode: "T1107" });
/** PayPal holding money while a dispute is looked into (T1110), as on 9 Nov's real dispute: money out, but not a refund. */
const hold = (id: string, captureId: string, amount: string): PayPalTransaction => ({ transactionId: id, referenceId: captureId, amount: `-${amount}`, currency: "EUR", status: "P", eventCode: "T1110" });

/** Things in PayPal's reply that belong to someone else, on every scenario. */
const NOISE: PayPalTransaction[] = [
  pay("OTHER1", "3.00", "other-stand/2026-11-03"),
  pay("YESTERDAY1", "1.20", "demo/2026-11-02"),
  { transactionId: "OLD1", referenceId: "2UW35693DK911573V", amount: "7.50", currency: "EUR", status: "S" },
  back("OLDREFUND", "OLD1", "0.50"),
];

type Scenario = { name: string; captures: LedgerCapture[]; refunds: LedgerRefund[]; transactions: PayPalTransaction[]; expect: string[] };

const base = { captures: [cap("C1", 120), cap("C2", 450), cap("C3", 90)], paypal: [pay("C1", "1.20"), pay("C2", "4.50"), pay("C3", "0.90")] };

const SCENARIOS: Scenario[] = [
  { name: "everything agrees", captures: base.captures, refunds: [], transactions: [...base.paypal, ...NOISE], expect: [] },
  {
    name: "agrees, with a refund made through Strawbank, and PayPal holding money for a dispute on another payment",
    captures: base.captures,
    refunds: [ref("R1", "C2", 450)],
    transactions: [...base.paypal, back("R1", "C2", "4.50"), hold("H1", "C1", "1.20"), ...NOISE],
    expect: [],
  },
  {
    name: "E7 as specified: a capture removed from the ledger, and a refund made in PayPal",
    captures: base.captures.filter((c) => c.captureId !== "C3"),
    refunds: [],
    transactions: [...base.paypal, back("R9", "C1", "0.60"), ...NOISE],
    expect: ["missing-in-ledger:payment:C3", "missing-in-ledger:refund:R9"],
  },
  {
    name: "an amount differs",
    captures: [cap("C1", 120), cap("C2", 405), cap("C3", 90)],
    refunds: [],
    transactions: [...base.paypal, ...NOISE],
    expect: ["amount-differs:payment:C2"],
  },
  {
    name: "the ledger has a payment PayPal does not show",
    captures: [...base.captures, cap("C4", 60)],
    refunds: [],
    transactions: [...base.paypal, ...NOISE],
    expect: ["missing-in-paypal:payment:C4"],
  },
  {
    name: "a refund in the ledger that PayPal does not show",
    captures: base.captures,
    refunds: [ref("R2", "C1", 60)],
    transactions: [...base.paypal, ...NOISE],
    expect: ["missing-in-paypal:refund:R2"],
  },
  {
    name: "a denied capture is not expected in PayPal's successes",
    captures: [...base.captures, cap("C5", 300, "DENIED")],
    refunds: [],
    transactions: [...base.paypal, ...NOISE],
    expect: [],
  },
];

const key = (d: AuditDifference) => `${d.kind}:${d.what}:${d.id}`;

export const e7: Eval = {
  id: "E7",
  title: "Next-morning audit",
  target: "every planted difference flagged, nothing else (7 scenarios; the live sandbox day follows)",
  async run() {
    const cases: object[] = [];
    let exact = 0;
    for (const s of SCENARIOS) {
      const result = auditDay({ standId: STAND, date: DATE, currency: "EUR", captures: s.captures, refunds: s.refunds, transactions: s.transactions });
      const got = result.differences.map(key).sort();
      const want = [...s.expect].sort();
      const ok = JSON.stringify(got) === JSON.stringify(want);
      if (ok) exact++;
      cases.push({ scenario: s.name, ok, flagged: got, planted: want });
    }
    const passed = exact === SCENARIOS.length;
    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: passed ? "pass" : "fail",
      ...(!passed && { reason: `${exact} of ${SCENARIOS.length} scenarios exactly right` }),
      metrics: { scenarios: SCENARIOS.length, exact },
      cases,
    };
  },
};
