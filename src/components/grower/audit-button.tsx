"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Runs the next-morning audit for one day: Strawbank's ledger against PayPal's Transaction Search.
export function AuditButton({ date, again }: { date: string; again?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const run = async () => {
    setState({ busy: true });
    const response = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setState({ error: body.error ?? "PayPal could not be asked just now" });
    else {
      setState({});
      router.refresh();
    }
  };
  return (
    <>
      <button type="button" disabled={state.busy} onClick={run} className="mt-4 block w-full rounded-full bg-ink py-3.5 text-center font-semibold text-canvas disabled:opacity-40">
        {state.busy ? "Asking PayPal…" : again ? "Check with PayPal again" : "Check this day with PayPal"}
      </button>
      {state.error && <p className="mt-2 text-sm text-gap">{state.error}</p>}
    </>
  );
}
