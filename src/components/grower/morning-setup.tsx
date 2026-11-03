"use client";

import Link from "next/link";
import { useState } from "react";
import { shrinkPhoto } from "@/components/stand/photo";

// F1 on the grower's phone: price card, then shelf, then open the stand.
// Every reading is shown for the grower to correct; nothing is priced until
// they press "Open the stand".

type Row = { key: string; name: string; price: string; unsure?: boolean };
type Step =
  | { kind: "prices"; busy?: boolean; ignored: string[]; problem?: string; error?: string }
  | { kind: "shelf"; busy?: boolean; counted: boolean; notes: Record<string, string>; problem?: string; error?: string }
  | { kind: "open"; date: string };

const SURE = 0.8;
const keyFor = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";

function PhotoButton({ label, onPhoto, primary }: { label: string; onPhoto: (file: File) => void; primary?: boolean }) {
  return (
    <label
      className={
        primary
          ? "flex w-full cursor-pointer items-center justify-center rounded-full border border-ink bg-straw px-6 py-4 text-lg font-semibold text-ink shadow-tag active:translate-y-px"
          : "cursor-pointer font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4"
      }
    >
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPhoto(file);
        }}
      />
    </label>
  );
}

async function send(url: string, file: File, extra?: Record<string, string>) {
  const form = new FormData();
  form.set("photo", await shrinkPhoto(file), "photo.jpg");
  for (const [k, v] of Object.entries(extra ?? {})) form.set(k, v);
  const response = await fetch(url, { method: "POST", body: form });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "something went wrong");
  return body;
}

export function MorningSetup({ standId, standing, currencySymbol }: { standId: string; standing: Row[]; currencySymbol: string }) {
  const [rows, setRows] = useState<Row[]>(standing);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [step, setStep] = useState<Step>({ kind: "prices", ignored: [] });

  const readCard = async (file: File) => {
    setStep({ kind: "prices", busy: true, ignored: [] });
    try {
      const reading = await send("/api/morning/card", file);
      const lines = reading.lines as { key: string; name: string; price: string; confidence: number }[];
      const names = new Map(standing.map((r) => [r.key, r.name]));
      setRows(lines.map((l) => ({ key: l.key, name: names.get(l.key) ?? l.name, price: l.price, unsure: l.confidence < SURE })));
      setStep({ kind: "prices", ignored: reading.ignored ?? [], problem: reading.problem });
    } catch (error) {
      setStep({ kind: "prices", ignored: [], error: (error as Error).message });
    }
  };

  const countShelf = async (file: File) => {
    setStep({ kind: "shelf", busy: true, counted: false, notes: {} });
    try {
      const reply = await send("/api/morning/shelf", file, { items: JSON.stringify(rows.map(({ key, name }) => ({ key, name }))) });
      setCounts(reply.counts);
      const notes: Record<string, string> = { ...reply.notes };
      for (const r of rows) if ((reply.confidence?.[r.key] ?? 0) < SURE && !notes[r.key]) notes[r.key] = "please check this count";
      setStep({ kind: "shelf", counted: true, notes, problem: reply.problem });
    } catch (error) {
      setStep({ kind: "shelf", counted: false, notes: {}, error: (error as Error).message });
    }
  };

  const open = async () => {
    setStep((s) => ({ ...s, busy: true }) as Step);
    const response = await fetch("/api/morning/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: rows.map(({ key, name, price }) => ({ key, name, price })), counts }),
    });
    const body = await response.json();
    if (!response.ok) setStep({ kind: "shelf", counted: true, notes: {}, error: body.error ?? "the stand could not be opened" });
    else setStep({ kind: "open", date: body.date });
  };

  const pricesValid = rows.length > 0 && rows.every((r) => r.name.trim() && /^\d{1,4}(\.\d{1,2})?$/.test(r.price) && Number(r.price) > 0);

  if (step.kind === "open") {
    return (
      <section className="mt-6 rounded-3xl border border-line bg-canvas p-5 shadow-card">
        <p className="eyebrow text-mint-ink">Open</p>
        <h2 className="display text-xl text-ink">The stand is open</h2>
        <p className="mt-2 text-ink-2">
          Customers see today&apos;s {rows.length} prices now, and tonight&apos;s dusk count is measured against this morning&apos;s.
        </p>
        <div className="mt-4 grid gap-2">
          <Link href={`/s/${standId}`} className="rounded-full bg-ink py-3 text-center font-semibold text-canvas">
            See the stand page
          </Link>
          <Link href="/grower" className="rounded-full border border-line-2 py-3 text-center font-semibold text-ink">
            Back to your stand
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <ol className="mt-6 flex gap-2 text-sm font-semibold">
        <li className={step.kind === "prices" ? "text-ink" : "text-ink-4"}>1. Prices</li>
        <li className="text-ink-4">·</li>
        <li className={step.kind === "shelf" ? "text-ink" : "text-ink-4"}>2. Shelf</li>
        <li className="text-ink-4">·</li>
        <li className="text-ink-4">3. Open</li>
      </ol>

      {step.kind === "prices" && (
        <section className="mt-4">
          <PhotoButton primary label={step.busy ? "Reading the card…" : "Photograph today's price card"} onPhoto={readCard} />
          <p className="mt-2 text-center text-sm text-ink-3">Or check yesterday&apos;s prices below and change what&apos;s different.</p>
          {step.error && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">{step.error}</p>}
          {step.problem && <p className="mt-4 rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">The card was hard to read: {step.problem}</p>}
          {step.ignored.length > 0 && (
            <div className="mt-4 rounded-2xl bg-unsure-soft px-4 py-3 text-sm text-ink">
              <p className="font-semibold">Also on the card, not a price, so ignored:</p>
              {step.ignored.map((t) => (
                <p key={t} className="mt-1 italic">&ldquo;{t}&rdquo;</p>
              ))}
            </div>
          )}
          <ul className="mt-4 space-y-2">
            {rows.map((row, i) => (
              <li key={row.key} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${row.unsure ? "border-straw bg-straw-soft" : "border-line bg-canvas"}`}>
                <input
                  aria-label="Item"
                  value={row.name}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value, unsure: false } : r)))}
                  className="min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none"
                />
                <span className="text-ink-3">{currencySymbol}</span>
                <input
                  aria-label={`Price of ${row.name}`}
                  inputMode="decimal"
                  value={row.price}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, price: e.target.value.trim(), unsure: false } : r)))}
                  className="w-16 rounded-lg border border-line-2 bg-canvas px-2 py-1 text-right font-mono text-ink"
                />
                <button type="button" aria-label={`Remove ${row.name}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="px-1 text-xl text-ink-3">
                  ×
                </button>
              </li>
            ))}
          </ul>
          {rows.some((r) => r.unsure) && <p className="mt-2 text-sm text-straw-ink">Highlighted lines were hard to read: check them.</p>}
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("What is the new item?")?.trim();
              if (name) setRows([...rows, { key: keyFor(name), name, price: "" }]);
            }}
            className="mt-3 text-sm font-semibold text-ink underline underline-offset-4"
          >
            Add an item
          </button>
          <button
            type="button"
            disabled={!pricesValid || step.busy}
            onClick={() => setStep({ kind: "shelf", counted: false, notes: {} })}
            className="mt-6 block w-full rounded-full bg-ink py-3.5 text-center font-semibold text-canvas disabled:opacity-40"
          >
            These prices are right
          </button>
        </section>
      )}

      {step.kind === "shelf" && (
        <section className="mt-4">
          <PhotoButton primary label={step.busy ? "Counting the shelf…" : step.counted ? "Retake the shelf photo" : "Photograph the stocked stand"} onPhoto={countShelf} />
          {step.error && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-ink">{step.error}</p>}
          {step.problem && <p className="mt-4 rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">The photo was hard to count: {step.problem}</p>}
          <p className="mt-4 text-sm text-ink-2">
            {step.counted ? "Counted from your photo. Change anything that's wrong." : "Or enter the counts yourself."}
          </p>
          <ul className="mt-2 space-y-2">
            {rows.map((row) => (
              <li key={row.key} className={`rounded-2xl border px-3 py-2 ${step.notes[row.key] ? "border-straw bg-straw-soft" : "border-line bg-canvas"}`}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-semibold text-ink">{row.name}</span>
                  <button type="button" aria-label={`One fewer ${row.name}`} onClick={() => setCounts({ ...counts, [row.key]: Math.max(0, (counts[row.key] ?? 0) - 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
                    −
                  </button>
                  <span className="w-8 text-center font-mono text-lg">{counts[row.key] ?? 0}</span>
                  <button type="button" aria-label={`One more ${row.name}`} onClick={() => setCounts({ ...counts, [row.key]: Math.min(999, (counts[row.key] ?? 0) + 1) })} className="grid h-10 w-10 place-items-center rounded-full border border-line-2 text-xl">
                    +
                  </button>
                </div>
                {step.notes[row.key] && <p className="mt-1 text-sm text-straw-ink">{step.notes[row.key]}</p>}
              </li>
            ))}
          </ul>
          <button type="button" disabled={step.busy} onClick={open} className="mt-6 block w-full rounded-full bg-ink py-3.5 text-center font-semibold text-canvas disabled:opacity-40">
            Open the stand
          </button>
          <button type="button" onClick={() => setStep({ kind: "prices", ignored: [] })} className="mt-3 block w-full text-center text-sm font-semibold text-ink-3 underline underline-offset-4">
            Back to the prices
          </button>
        </section>
      )}
    </>
  );
}
