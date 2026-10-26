// The product's own paper and screens, as cards on the landing page: the
// grower's chalk price card, the refund, the dusk report. They are an example
// day: the prices and counts are made up, and they add up.

import type { ReactNode } from "react";

/** One word in a headline, underlined the way a grower marks a price card. */
export function Marked({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg aria-hidden viewBox="0 0 200 18" preserveAspectRatio="none" className="absolute -bottom-[0.12em] left-[-2%] h-[0.28em] w-[104%]">
        <path d="M3 12 C 40 5, 90 4, 120 8 S 175 13, 197 6" fill="none" stroke="var(--color-straw)" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Example() {
  return <span className="eyebrow text-ink-4">Example</span>;
}

function Tick() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 flex-none">
      <circle cx="8" cy="8" r="8" fill="var(--color-mint)" />
      <path d="M4.5 8.3 7 10.6l4.6-5" fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PRICES = [
  { chalk: "Eggs (6)", read: "Eggs, box of 6", price: "3.50" },
  { chalk: "Onions, bag", read: "Onions, bag", price: "2.00" },
  { chalk: "Potatoes, bag", read: "Potatoes, bag", price: "3.00" },
  { chalk: "Jam", read: "Jam, jar", price: "4.50" },
];

export function PriceCardArtefact() {
  return (
    <div className="mt-8 max-w-[520px]">
      <div className="w-[82%] -rotate-2 rounded-md border-[10px] border-wood bg-chalk px-6 pb-6 pt-4 font-hand text-chalk-line shadow-card sm:w-[72%]">
        <p className="text-3xl font-bold">Today</p>
        <ul className="mt-2 space-y-1 text-xl">
          {PRICES.map((p) => (
            <li key={p.chalk} className="flex items-baseline gap-2">
              <span>{p.chalk}</span>
              <span className="flex-1 border-b-2 border-dotted border-chalk-line/30" />
              <span>€{p.price.replace(/\.00$/, "")}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative -mt-6 ml-auto w-[88%] rounded-2xl border border-ink bg-white p-4 shadow-tag sm:w-[70%]">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow text-ink-3">Read from the photo</p>
          <Example />
        </div>
        <ul className="mt-3 space-y-2">
          {PRICES.map((p) => (
            <li key={p.read} className="flex items-center gap-2 text-sm">
              <Tick />
              <span className="flex-1 text-ink">{p.read}</span>
              <span className="font-mono text-ink">€{p.price}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-line pt-2 font-mono text-[0.6875rem] text-ink-3">
          4 lines confirmed by the grower · now in the PayPal catalogue
        </p>
      </div>
    </div>
  );
}

export function RefundArtefact() {
  return (
    <div className="mt-8 grid max-w-[540px] gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:items-start">
      <div className="receipt-edge rotate-1 bg-white px-5 pb-8 pt-5 font-mono text-[0.75rem] leading-relaxed text-ink shadow-card">
        <p className="text-center font-semibold tracking-[0.2em]">STRAWBANK</p>
        <p className="text-center text-ink-3">receipt · 11:16</p>
        <div className="mt-3 border-t border-dashed border-line-2 pt-2">
          <p className="flex justify-between">
            <span>Eggs (6) 1 × 3.50</span>
            <span>3.50</span>
          </p>
          <p className="flex justify-between">
            <span>Onions 2 × 2.00</span>
            <span>4.00</span>
          </p>
        </div>
        <p className="mt-2 flex justify-between border-t border-dashed border-line-2 pt-2 font-semibold">
          <span>Total</span>
          <span>€7.50</span>
        </p>
        <p className="mt-1 text-ink-3">Paid with PayPal</p>
        <p className="mt-3 font-sans text-sm font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4">
          Something&apos;s wrong?
        </p>
      </div>

      <div className="space-y-3">
        <div className="ml-6 rounded-2xl rounded-tr-sm bg-paper px-4 py-3 text-sm text-ink">
          I took one bag of onions, not two.
          <p className="mt-1 font-mono text-[0.6875rem] text-ink-3">customer · 11:20</p>
        </div>
        <div className="rounded-2xl border border-ink bg-white p-4 shadow-tag">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow text-ink-3">The agent</p>
            <Example />
          </div>
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <Tick />
              <span>Recounted the basket photo: 1 bag of onions, sure</span>
            </li>
            <li className="flex gap-2">
              <Tick />
              <span>
                Refund, worked out by code: <span className="font-mono">1 × €2.00 = €2.00</span>
              </span>
            </li>
            <li className="flex gap-2">
              <Tick />
              <span>Within the grower&apos;s limit of €5.00</span>
            </li>
          </ul>
          <p className="mt-3 inline-block rounded-full bg-mint px-3 py-1 text-sm font-semibold text-ink">Refunded €2.00 through PayPal</p>
          <p className="mt-3 border-t border-line pt-2 font-mono text-[0.6875rem] text-ink-3">
            Over the limit, or a photo that disagrees: the grower decides.
          </p>
        </div>
      </div>
    </div>
  );
}

const DUSK = [
  { item: "Eggs (6)", taken: "9", paid: "9", gap: null },
  { item: "Onions, bag", taken: "7", paid: "6", gap: "1 · €2.00" },
  { item: "Potatoes, bag", taken: "5", paid: "5", gap: null },
  { item: "Jam", taken: null, paid: "3", gap: null },
];

export function DuskArtefact() {
  return (
    <div className="mt-8 max-w-[520px] rounded-[26px] border border-line bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow text-ink-3">Dusk report</p>
        <Example />
      </div>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="eyebrow py-2 font-medium text-ink-3">Item</th>
            <th className="eyebrow py-2 text-right font-medium text-ink-3">Taken</th>
            <th className="eyebrow py-2 text-right font-medium text-ink-3">Paid</th>
            <th className="eyebrow py-2 text-right font-medium text-ink-3">Gap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {DUSK.map((row) => (
            <tr key={row.item}>
              <td className="py-2.5 font-medium text-ink">{row.item}</td>
              <td className="py-2.5 text-right font-mono text-ink">
                {row.taken ?? <span className="rounded-full bg-unsure-soft px-2 py-0.5 font-sans text-xs font-medium text-unsure">uncertain</span>}
              </td>
              <td className="py-2.5 text-right font-mono text-ink">{row.paid}</td>
              <td className="py-2.5 text-right">
                {row.gap ? (
                  <span className="rounded-full bg-gap-soft px-2 py-0.5 font-mono text-xs font-medium text-gap">{row.gap}</span>
                ) : row.taken ? (
                  <span className="font-mono text-ink-4">0</span>
                ) : (
                  <span className="text-xs text-ink-4">not counted</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 rounded-2xl bg-paper p-4 text-[0.9375rem] leading-relaxed text-ink">
        Eggs and potatoes were all paid for. 7 bags of onions were taken and 6 paid for, so 1 bag, worth €2.00, is
        unaccounted for. The jam count is uncertain, so it is not called missing: check the shelf photo.
      </div>
      <p className="mt-3 flex gap-2 font-mono text-[0.6875rem] leading-relaxed text-ink-3">
        <Tick />
        Every number in the note matched the table, so the AI&apos;s words are shown. If one had not, a plain template
        would be.
      </p>
    </div>
  );
}
