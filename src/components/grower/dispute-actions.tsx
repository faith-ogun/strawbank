"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// The grower's two answers to a dispute. PayPal does each one.
export function DisputeActions({ disputeId, canSend, canRefund, amount }: { disputeId: string; canSend: boolean; canRefund: boolean; amount: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: string }>({});
  const act = async (action: "evidence" | "refund") => {
    setState({ busy: true });
    const response = await fetch(`/api/disputes/${disputeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ error: body.error ?? "that did not go through" });
    setState({ done: action === "evidence" ? `Sent to PayPal${body.withPhoto ? ", with the basket photo" : ""}.` : "PayPal is refunding the customer." });
    router.refresh();
  };
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <button type="button" disabled={state.busy || !canSend} onClick={() => act("evidence")} className="rounded-full bg-ink py-2.5 font-semibold text-canvas disabled:opacity-40">
          Send this to PayPal
        </button>
        <button type="button" disabled={state.busy || !canRefund} onClick={() => act("refund")} className="rounded-full border border-line-2 py-2.5 font-semibold text-ink disabled:opacity-40">
          Refund {amount} instead
        </button>
      </div>
      {!canSend && <p className="mt-2 text-xs text-ink-3">PayPal is not asking for evidence on this one right now.</p>}
      {state.done && <p className="mt-2 text-sm text-mint-ink">{state.done}</p>}
      {state.error && <p className="mt-2 text-sm text-gap">{state.error}</p>}
    </div>
  );
}

const SANDBOX_DONE: Record<string, string> = {
  "ask-for-evidence": "PayPal now asks the stand for evidence.",
  "decide-for-stand": "PayPal decided for the stand.",
  "decide-for-customer": "PayPal decided for the customer.",
};

// The sandbox's stand-ins for PayPal's own staff, so a dispute can be tried end
// to end. Shown only when PayPal offers the step on this dispute.
export function SandboxDisputeSteps({ disputeId, canAsk, canDecide }: { disputeId: string; canAsk: boolean; canDecide: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: string }>({});
  const act = async (action: "ask-for-evidence" | "decide-for-stand" | "decide-for-customer") => {
    setState({ busy: true });
    const response = await fetch(`/api/disputes/${disputeId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ error: body.error ?? "that did not go through" });
    setState({ done: SANDBOX_DONE[action] });
    router.refresh();
  };
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Sandbox test steps</p>
      <p className="mt-1 text-xs text-ink-3">In a real dispute, PayPal&apos;s own staff take these steps. The sandbox lets you take them here.</p>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {canAsk && (
          <button type="button" disabled={state.busy} onClick={() => act("ask-for-evidence")} className="rounded-full border border-line-2 px-3 py-1.5 font-semibold text-ink disabled:opacity-40">
            Have PayPal ask for evidence
          </button>
        )}
        {canDecide && (
          <>
            <button type="button" disabled={state.busy} onClick={() => act("decide-for-stand")} className="rounded-full border border-line-2 px-3 py-1.5 font-semibold text-ink disabled:opacity-40">
              PayPal decides for the stand
            </button>
            <button type="button" disabled={state.busy} onClick={() => act("decide-for-customer")} className="rounded-full border border-line-2 px-3 py-1.5 font-semibold text-ink disabled:opacity-40">
              PayPal decides for the customer
            </button>
          </>
        )}
      </div>
      {state.done && <p className="mt-2 text-sm text-mint-ink">{state.done}</p>}
      {state.error && <p className="mt-2 text-sm text-gap">{state.error}</p>}
    </div>
  );
}
