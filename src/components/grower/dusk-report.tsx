import Link from "next/link";
import type { Dusk } from "@/lib/days";
import { type Currency, formatMoney } from "@/lib/money";

// F3's result: per item, taken, paid for and unaccounted for (all code), the
// agent's note on it, and every payment with PayPal's word on it. Shared by the
// dusk page (a closed day) and the close step (just closed).

const shortName = (name: string) => name.replace(/, each$/i, "");
const SOURCE: Record<string, string> = {
  webhook: "paid; PayPal's signed webhook confirms it",
  capture: "paid; PayPal's signed webhook not in yet",
  cash: "IOU paid in cash; recorded in PayPal",
  none: "started, never paid",
};

function said(p: Dusk["payments"][number]): string {
  if (p.source !== "invoice") return SOURCE[p.source];
  return p.payment === "confirmed" ? "IOU paid; PayPal's signed webhook confirms it" : p.payment === "pending" ? "IOU; PayPal has sent the invoice" : "IOU cancelled";
}

export function DuskReport({ dusk, currency }: { dusk: Dusk; currency: Currency }) {
  const gapMinor = dusk.items.reduce((sum, i) => sum + i.gapMinor, 0);
  const confirmed = dusk.payments.filter((p) => p.payment === "confirmed");
  const pending = dusk.payments.filter((p) => p.payment === "pending");
  const unpaid = dusk.payments.filter((p) => p.payment === "unpaid");
  const claims = dusk.items.some((i) => (i.claimed ?? 0) > 0);
  return (
    <section className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-mint-soft px-4 py-3">
          <p className="eyebrow text-mint-ink">Paid, confirmed by PayPal</p>
          <p className="display text-2xl text-ink">{formatMoney(dusk.takingsMinor, currency)}</p>
          <p className="text-sm text-ink-2">{confirmed.length} payment{confirmed.length === 1 ? "" : "s"}</p>
        </div>
        <div className={`rounded-2xl px-4 py-3 ${gapMinor > 0 ? "bg-gap-soft" : "bg-paper"}`}>
          <p className={`eyebrow ${gapMinor > 0 ? "text-gap" : "text-ink-3"}`}>Unaccounted for</p>
          <p className="display text-2xl text-ink">{formatMoney(gapMinor, currency)}</p>
          <p className="text-sm text-ink-2">at today&apos;s prices</p>
        </div>
      </div>

      <div className="rounded-[22px] border border-line bg-canvas p-4 shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="eyebrow py-2 font-medium text-ink-3">Item</th>
              <th className="eyebrow py-2 text-right font-medium text-ink-3">Taken</th>
              <th className="eyebrow py-2 text-right font-medium text-ink-3">Paid</th>
              <th className="eyebrow py-2 text-right font-medium text-ink-3">Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {dusk.items.map((row) => (
              <tr key={row.key}>
                <td className="py-2.5 font-medium text-ink">
                  {shortName(row.name)}
                  <span className="block text-xs font-normal text-ink-3">
                    {row.morning}
                    {row.restocked > 0 ? ` + ${row.restocked}` : ""} this morning, {row.dusk} left
                  </span>
                  {(row.claimed ?? 0) > 0 && (
                    <span className="block text-xs font-normal text-straw-ink">{row.claimed} under a refund claim you have not decided</span>
                  )}
                </td>
                <td className="py-2.5 text-right font-mono text-ink">{row.taken}</td>
                <td className="py-2.5 text-right font-mono text-ink">{row.paid}</td>
                <td className="py-2.5 text-right">
                  {row.uncertain ? (
                    <span className="rounded-full bg-unsure-soft px-2 py-0.5 text-xs font-medium text-unsure">uncertain</span>
                  ) : row.gap > 0 ? (
                    <span className="rounded-full bg-gap-soft px-2 py-0.5 font-mono text-xs font-medium text-gap">
                      {row.gap} · {formatMoney(row.gapMinor, currency)}
                    </span>
                  ) : (
                    <span className="font-mono text-ink-4">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {claims && (
          <p className="mt-3 rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">
            A refund claim is waiting for you. Until you decide it, its item is marked uncertain: if the customer is right, goods were taken that nobody paid for.{" "}
            <a href="/grower/refunds" className="font-semibold underline underline-offset-4">
              Decide it under Refunds
            </a>
            , then close the stand again.
          </p>
        )}
        <div className="mt-4 rounded-2xl bg-paper p-4 text-[0.9375rem] leading-relaxed text-ink">{dusk.explanation.text}</div>
        <p className="mt-3 font-mono text-[0.6875rem] leading-relaxed text-ink-3">
          {dusk.explanation.source === "model"
            ? "Written by the AI from the table. Every number in it was checked against the table before it was shown."
            : "Written by code from the table: the AI's note was not used (it was missing, or had a number that is not in the table)."}
        </p>
      </div>

      <div className="rounded-[22px] border border-line bg-canvas p-4">
        <p className="eyebrow text-ink-3">Today&apos;s payments</p>
        {dusk.payments.length === 0 && <p className="mt-2 text-sm text-ink-2">No payments today.</p>}
        <ul className="mt-2 divide-y divide-line">
          {[...confirmed, ...pending, ...unpaid].map((p) => (
            <li key={p.orderId} className="py-2 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-ink">{formatMoney(p.totalMinor, currency)}</span>
                <span className={p.payment === "confirmed" ? "text-mint-ink" : p.payment === "pending" ? "text-straw-ink" : "text-ink-4"}>
                  {said(p)}
                </span>
              </div>
              <p className="font-mono text-[0.6875rem] text-ink-3">
                {p.source === "invoice" || p.source === "cash" ? "IOU invoice" : "order"} {p.orderId}
                {p.captureId ? ` · capture ${p.captureId}` : ""}
                {p.refundedMinor > 0 ? ` · ${formatMoney(p.refundedMinor, currency)} refunded` : ""}
              </p>
            </li>
          ))}
        </ul>
        {pending.length > 0 && (
          <p className="mt-2 text-sm text-straw-ink">
            Items in a payment still waiting for PayPal are marked uncertain, never missing. Close the stand again later to update.
          </p>
        )}
      </div>

      <div className="rounded-[22px] border border-line bg-canvas p-4">
        <p className="eyebrow text-ink-3">What next</p>
        <p className="mt-1 text-sm text-ink-2">
          Tomorrow morning, the audit checks PayPal&apos;s own records agree with this report. To run the stand again now, start a new day: it begins from a new count of the shelf.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/grower/morning?new=1" className="rounded-full bg-ink py-3 text-center font-semibold text-canvas">
            Start a new day
          </Link>
          <Link href="/grower" className="rounded-full border border-line-2 py-3 text-center font-semibold text-ink">
            Back to today
          </Link>
        </div>
      </div>
    </section>
  );
}
