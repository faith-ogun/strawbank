"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// F4 on the customer's phone: "something's wrong" under the receipt. They say
// how many of each thing they really took; the agent recounts their basket
// photo and code decides. They never type an amount of money.

type Line = { key: string; name: string; quantity: number };

export function RefundClaim({ orderId, lines }: { orderId: string; lines: Line[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [took, setTook] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.key, l.quantity])));
  const [state, setState] = useState<{ busy?: boolean; message?: string; status?: string; error?: string }>({});
  const changed = lines.some((l) => took[l.key] < l.quantity);

  if (!open) {
    return (
      <p className="mt-6 text-center">
        <button type="button" onClick={() => setOpen(true)} className="font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4">
          Something&apos;s wrong with this?
        </button>
      </p>
    );
  }

  const send = async () => {
    setState({ busy: true });
    const response = await fetch("/api/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, claimed: took }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState({ error: body.error ?? "the claim could not be sent" });
    else {
      // The receipt reloads with the claim's message above, and this card goes; until then, it shows here.
      setState({ message: body.message, status: body.status });
      router.refresh();
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-line bg-canvas p-5 shadow-card">
      <h2 className="display text-xl text-ink">Charged for more than you took?</h2>
      <p className="mt-1 text-sm text-ink-2">Say how many you really took. The stand&apos;s agent checks your basket photo, and small refunds go straight back to your PayPal.</p>
      <ul className="mt-4 space-y-2">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2">
            <span className="flex-1 font-semibold text-ink">
              {line.name.replace(/, each$/i, "")}
              <span className="block text-xs font-normal text-ink-3">charged for {line.quantity}</span>
            </span>
            <button type="button" aria-label={`One fewer ${line.name}`} onClick={() => setTook({ ...took, [line.key]: Math.max(0, took[line.key] - 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
              −
            </button>
            <span className="w-8 text-center font-mono text-lg">{took[line.key]}</span>
            <button type="button" aria-label={`One more ${line.name}`} onClick={() => setTook({ ...took, [line.key]: Math.min(line.quantity, took[line.key] + 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
              +
            </button>
          </li>
        ))}
      </ul>
      {state.error && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">{state.error}</p>}
      {state.message ? (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm text-ink ${state.status === "COMPLETED" ? "bg-mint-soft" : "bg-straw-soft"}`}>{state.message}</p>
      ) : (
        <button type="button" disabled={!changed || state.busy} onClick={send} className="mt-4 block w-full rounded-full bg-ink py-3.5 text-center font-semibold text-canvas disabled:opacity-40">
          {state.busy ? "Checking your basket photo…" : "Send"}
        </button>
      )}
    </section>
  );
}
