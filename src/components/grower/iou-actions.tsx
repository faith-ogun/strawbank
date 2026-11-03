"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The grower's three answers to an open IOU. PayPal does each one.
export function IouActions({ invoiceId, amount }: { invoiceId: string; amount: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: string }>({});
  const act = async (action: "remind" | "cash" | "cancel") => {
    setState({ busy: true });
    const response = await fetch(`/api/ious/${invoiceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState({ error: body.error ?? "that did not go through" });
    else {
      setState({ done: action === "remind" ? "PayPal has sent a reminder." : undefined });
      router.refresh();
    }
  };
  return (
    <div className="mt-3">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <button type="button" disabled={state.busy} onClick={() => act("remind")} className="rounded-full border border-line-2 py-2.5 font-semibold text-ink disabled:opacity-40">
          Remind
        </button>
        <button type="button" disabled={state.busy} onClick={() => act("cash")} className="rounded-full bg-ink py-2.5 font-semibold text-canvas disabled:opacity-40">
          Paid {amount} cash
        </button>
        <button type="button" disabled={state.busy} onClick={() => act("cancel")} className="rounded-full border border-line-2 py-2.5 font-semibold text-ink-3 disabled:opacity-40">
          Cancel it
        </button>
      </div>
      {state.done && <p className="mt-2 text-sm text-mint-ink">{state.done}</p>}
      {state.error && <p className="mt-2 text-sm text-gap">{state.error}</p>}
    </div>
  );
}
