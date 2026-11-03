import type { Dusk } from "@/lib/days";
import { type Currency, formatMoney } from "@/lib/money";

// F3's result: per item, taken, paid for and unaccounted for (all code), the
// agent's note on it, and every payment with PayPal's word on it. Shared by the
// dusk page (a closed day) and the close step (just closed).

const shortName = (name: string) => name.replace(/, each$/i, "");
const SOURCE: Record<string, string> = {
  webhook: "confirmed by PayPal's signed webhook",
  capture: "captured; waiting for PayPal's signed webhook",
  none: "started, never paid",
};

export function DuskReport({ dusk, currency }: { dusk: Dusk; currency: Currency }) {
  const gapMinor = dusk.items.reduce((sum, i) => sum + i.gapMinor, 0);
  const confirmed = dusk.payments.filter((p) => p.payment === "confirmed");
  const pending = dusk.payments.filter((p) => p.payment === "pending");
  const unpaid = dusk.payments.filter((p) => p.payment === "unpaid");
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
                  {SOURCE[p.source]}
                </span>
              </div>
              <p className="font-mono text-[0.6875rem] text-ink-3">
                order {p.orderId}
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
    </section>
  );
}
