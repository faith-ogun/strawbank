"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The grower's two answers to a waiting refund request. The amount is code's.
export function RefundDecision({ requestId, amount }: { requestId: string; amount: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const decide = async (action: "refund" | "decline") => {
    setState({ busy: true });
    const response = await fetch(`/api/refunds/${requestId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState({ error: body.error ?? "that did not go through" });
    else router.refresh();
  };
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={state.busy} onClick={() => decide("refund")} className="rounded-full bg-ink py-3 font-semibold text-canvas disabled:opacity-40">
          Refund {amount}
        </button>
        <button type="button" disabled={state.busy} onClick={() => decide("decline")} className="rounded-full border border-line-2 py-3 font-semibold text-ink disabled:opacity-40">
          Decline
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-gap">{state.error}</p>}
    </div>
  );
}
