"use client";

// The honesty-box IOU on the customer's phone: for someone with no PayPal to
// hand. They leave an email address and PayPal sends them an invoice for this
// basket, at the stand's prices, to pay this week. Nothing else is asked.

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IouForm({ standId, counts, countId }: { standId: string; counts: Record<string, number>; countId?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/ious", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ standId, counts, countId, email, requestId: crypto.randomUUID() }),
      });
      const body = (await response.json().catch(() => ({}))) as { invoiceId?: string; error?: string };
      if (!response.ok || !body.invoiceId) throw new Error(body.error ?? `the server said ${response.status}`);
      router.push(`/s/${standId}/iou/${body.invoiceId}`);
    } catch (e) {
      setError(`The IOU was not sent (${e instanceof Error ? e.message : "unknown error"}). Please try again.`);
      setSending(false);
    }
  }

  return (
    <details className="mt-4 rounded-2xl border border-line bg-paper px-4 py-3">
      <summary className="cursor-pointer font-semibold text-ink">No PayPal to hand? Leave an IOU</summary>
      <form onSubmit={send} className="mt-3 space-y-3">
        <p className="text-sm text-ink-2">PayPal will email you an invoice for this basket. Pay it any time in the next ten days, by PayPal or card.</p>
        <label className="block text-sm font-semibold text-ink">
          Your email address
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-line-2 bg-canvas px-3 py-2.5 font-normal text-ink"
          />
        </label>
        {error && <p className="rounded-xl bg-gap-soft px-3 py-2 text-sm text-gap">{error}</p>}
        <button type="submit" disabled={sending} className="w-full rounded-full bg-ink py-3 font-semibold text-canvas disabled:opacity-60">
          {sending ? "Asking PayPal…" : "Send me the invoice"}
        </button>
        <p className="text-xs text-ink-4">Strawbank keeps only the first letter of your address; PayPal holds the rest. Sandbox only, no real money.</p>
      </form>
    </details>
  );
}
