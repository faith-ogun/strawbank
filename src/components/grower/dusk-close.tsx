"use client";

import { useState } from "react";
import { shrinkPhoto } from "@/components/stand/photo";
import type { Dusk } from "@/lib/days";
import type { Currency } from "@/lib/money";
import { DuskReport } from "./dusk-report";

// F3 on the grower's phone: photograph the shelf, check what the AI counted,
// close the stand, and see what sold and what walked. A count the AI is unsure
// of is highlighted; one the grower changes counts as sure.

type Item = { key: string; name: string };
type Step =
  | { kind: "count"; busy?: boolean; counted: boolean; notes: Record<string, string>; problem?: string; error?: string }
  | { kind: "closing" }
  | { kind: "closed"; dusk: Dusk };

const SURE = 0.8;

export function DuskClose({ items, currency, again }: { items: Item[]; currency: Currency; again?: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.key, 0])));
  const [step, setStep] = useState<Step>({ kind: "count", counted: false, notes: {} });

  const countShelf = async (file: File) => {
    setStep({ kind: "count", busy: true, counted: false, notes: {} });
    try {
      const form = new FormData();
      form.set("photo", await shrinkPhoto(file), "shelf.jpg");
      const response = await fetch("/api/dusk/count", { method: "POST", body: form });
      const reply = await response.json();
      if (!response.ok) throw new Error(reply.error ?? "the shelf could not be counted");
      setCounts(Object.fromEntries(items.map((i) => [i.key, reply.counts?.[i.key] ?? 0])));
      const notes: Record<string, string> = { ...reply.notes };
      for (const i of items) if ((reply.confidence?.[i.key] ?? 0) < SURE && !notes[i.key]) notes[i.key] = "please check this count";
      setStep({ kind: "count", counted: true, notes, problem: reply.problem });
    } catch (error) {
      setStep({ kind: "count", counted: false, notes: {}, error: (error as Error).message });
    }
  };

  const close = async () => {
    setStep({ kind: "closing" });
    const response = await fetch("/api/dusk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counts }) });
    const body = await response.json();
    if (!response.ok) setStep({ kind: "count", counted: true, notes: {}, error: body.error ?? "the stand could not be closed" });
    else setStep({ kind: "closed", dusk: body as Dusk });
  };

  if (step.kind === "closed") return <DuskReport dusk={step.dusk} currency={currency} />;

  const busy = step.kind === "closing" || step.busy;
  const notes = step.kind === "count" ? step.notes : {};
  return (
    <section className="mt-6">
      <label className="flex w-full cursor-pointer items-center justify-center rounded-full border border-ink bg-straw px-6 py-4 text-lg font-semibold text-ink shadow-tag active:translate-y-px">
        {step.kind === "count" && step.busy ? "Counting the shelf…" : step.kind === "count" && step.counted ? "Retake the shelf photo" : "Photograph what is left"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void countShelf(file);
          }}
        />
      </label>
      {step.kind === "count" && step.error && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">{step.error}</p>}
      {step.kind === "count" && step.problem && <p className="mt-4 rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">The photo was hard to count: {step.problem}</p>}
      <p className="mt-4 text-sm text-ink-2">
        {step.kind === "count" && step.counted ? "Counted from your photo. Change anything that's wrong." : "Or count what is left yourself."}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key} className={`rounded-2xl border px-3 py-2 ${notes[item.key] ? "border-straw bg-straw-soft" : "border-line bg-canvas"}`}>
            <div className="flex items-center gap-3">
              <span className="flex-1 font-semibold text-ink">{item.name.replace(/, each$/i, "")}</span>
              <button type="button" aria-label={`One fewer ${item.name}`} onClick={() => setCounts({ ...counts, [item.key]: Math.max(0, counts[item.key] - 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
                −
              </button>
              <span className="w-8 text-center font-mono text-lg">{counts[item.key]}</span>
              <button type="button" aria-label={`One more ${item.name}`} onClick={() => setCounts({ ...counts, [item.key]: Math.min(999, counts[item.key] + 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
                +
              </button>
            </div>
            {notes[item.key] && <p className="mt-1 text-sm text-straw-ink">{notes[item.key]}</p>}
          </li>
        ))}
      </ul>
      <button type="button" disabled={busy} onClick={close} className="mt-6 block w-full rounded-full bg-ink py-3.5 text-center font-semibold text-canvas disabled:opacity-40">
        {step.kind === "closing" ? "Working out the day…" : again ? "Close the stand again" : "Close the stand"}
      </button>
    </section>
  );
}
