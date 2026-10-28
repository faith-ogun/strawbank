"use client";

// The customer's basket, as the stand page will show it. The plus and minus
// buttons work, and the total comes from the same tested code the real order
// uses (src/lib/orders.ts), never from the model.

import { useState } from "react";
import { DEMO_CATALOGUE } from "@/lib/demo-stand";
import { formatMoney, toDecimal } from "@/lib/money";
import { MAX_QUANTITY, buildLines, orderTotalMinor } from "@/lib/orders";

/** The two items in the example basket, at the demo stand's own prices. */
const CATALOGUE = DEMO_CATALOGUE.filter((item) => item.key === "eggs-6" || item.key === "onions-bag");

/** What the AI counted in the basket photo, and how sure it was. An example. */
const COUNTED: Record<string, { count: number; sure: boolean }> = {
  "eggs-6": { count: 1, sure: true },
  "onions-bag": { count: 2, sure: false },
};

export function BasketCard() {
  const [counts, setCounts] = useState(() => Object.fromEntries(CATALOGUE.map((i) => [i.key, COUNTED[i.key].count])));
  const lines = Object.values(counts).some((n) => n > 0) ? buildLines(CATALOGUE, counts) : [];
  const total = lines.length > 0 ? orderTotalMinor(lines) : 0;
  const sum = lines.map((l) => `${l.quantity} × ${toDecimal(l.unitMinor)}`).join(" + ") || "nothing yet";

  const change = (key: string, by: number) =>
    setCounts((c) => ({ ...c, [key]: Math.min(MAX_QUANTITY, Math.max(0, c[key] + by)) }));

  return (
    <div className="w-full max-w-[380px] rounded-[26px] border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink-3">Your basket</p>
        <p className="eyebrow text-ink-4">Example</p>
      </div>
      <p className="mt-1 text-sm text-ink-3">Counted from your photo. Change anything that is wrong.</p>

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {CATALOGUE.map((item) => {
          const sure = COUNTED[item.key].sure && counts[item.key] === COUNTED[item.key].count;
          const changed = counts[item.key] !== COUNTED[item.key].count;
          return (
            <li key={item.key} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{item.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs">
                  <span className="font-mono text-ink-3">{formatMoney(item.unitMinor, "EUR")} each</span>
                  {changed ? (
                    <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-straw-ink">you changed this</span>
                  ) : sure ? (
                    <span className="rounded-full bg-mint-soft px-2 py-0.5 font-medium text-mint-ink">sure</span>
                  ) : (
                    <span className="rounded-full bg-straw-soft px-2 py-0.5 font-medium text-straw-ink">please check</span>
                  )}
                </p>
              </div>
              <div className="flex items-center rounded-full border border-line-2">
                <button
                  type="button"
                  onClick={() => change(item.key, -1)}
                  className="grid h-9 w-9 place-items-center rounded-full text-lg text-ink hover:bg-paper"
                  aria-label={`One fewer: ${item.name}`}
                >
                  −
                </button>
                <span className="w-6 text-center font-mono font-semibold tabular-nums text-ink" aria-live="polite">
                  {counts[item.key]}
                </span>
                <button
                  type="button"
                  onClick={() => change(item.key, 1)}
                  className="grid h-9 w-9 place-items-center rounded-full text-lg text-ink hover:bg-paper"
                  aria-label={`One more: ${item.name}`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-ink-3">Total</p>
          <p className="font-mono text-xs text-ink-4">{sum}, worked out by code</p>
        </div>
        <p className="display text-4xl tabular-nums text-ink">{formatMoney(total, "EUR")}</p>
      </div>
      <div
        className={`mt-4 rounded-full bg-ink py-3 text-center font-semibold text-white ${total === 0 ? "opacity-40" : ""}`}
        aria-hidden
      >
        Pay {formatMoney(total, "EUR")} with PayPal
      </div>
      <p className="mt-2 text-center text-xs text-ink-4">PayPal wallet or card · sandbox only</p>
    </div>
  );
}
