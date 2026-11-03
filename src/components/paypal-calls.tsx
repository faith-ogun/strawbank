import type { PayPalCall } from "@/lib/paypal/calls";

// What Strawbank asked PayPal, call by call, with PayPal's own answer: shown to
// the grower for their stand and to the customer for their order.

const WHO: Record<PayPalCall["who"], string> = { customer: "customer", grower: "grower", agent: "agent", webhook: "PayPal webhook" };

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Dublin" }).format(new Date(iso));

export function PayPalCalls({ calls, title, open }: { calls: PayPalCall[]; title: string; open?: boolean }) {
  if (calls.length === 0) return null;
  return (
    <details open={open} className="mt-6 rounded-3xl border border-line bg-canvas px-4 py-3">
      <summary className="cursor-pointer font-semibold text-ink">
        {title} <span className="font-normal text-ink-3">({calls.length})</span>
      </summary>
      <ul className="mt-2 divide-y divide-line">
        {calls.map((call, i) => (
          <li key={`${call.at}-${i}`} className="py-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink">{call.what}</span>
              <span className={`shrink-0 font-mono text-xs ${call.ok ? "text-mint-ink" : "text-gap"}`}>{call.ok ? (call.status ?? "ok") : (call.status ?? "failed")}</span>
            </div>
            <p className="break-all font-mono text-[0.6875rem] leading-relaxed text-ink-3">
              {call.endpoint} · {WHO[call.who]} · {call.ms} ms · {time(call.at)}
              {call.ref ? ` · ${call.ref}` : ""}
              {call.debugId ? ` · PayPal debug id ${call.debugId}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
