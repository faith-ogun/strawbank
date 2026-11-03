"use client";

// F2 on the customer's phone: today's prices, a photo of the basket, the AI's
// count with plus and minus buttons, the total, and PayPal. The total shown is
// worked out by src/lib/orders.ts; the server works it out again from its own
// prices when it creates the order. The customer has the final word on every
// count: it is still an honesty box.

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { BasketCount } from "@/lib/ai/count";
import { type Currency, formatMoney } from "@/lib/money";
import { type CatalogueItem, MAX_QUANTITY, buildLines, orderTotalMinor } from "@/lib/orders";
import { IouForm } from "./iou-form";
import { PayPalButton } from "./paypal-button";
import { shrinkPhoto } from "./photo";

type CountReply = BasketCount & { sureAt: number; countId?: string };

type Phase =
  | { kind: "start" }
  | { kind: "counting"; preview: string }
  | { kind: "review"; preview?: string; reply?: CountReply; countId?: string }
  | { kind: "paying" };

type Props = { standId: string; standName: string; currency: Currency; catalogue: CatalogueItem[]; paypalClientId: string };

const zeros = (catalogue: CatalogueItem[]) => Object.fromEntries(catalogue.map((i) => [i.key, 0]));

/** "the box is closed: open it" -> "The box is closed: open it." */
const asSentence = (text: string) => `${text[0].toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? "" : "."}`;

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `the server said ${response.status}`;
}

function CameraIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function StandShop({ standId, standName, currency, catalogue, paypalClientId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "start" });
  const [counts, setCounts] = useState<Record<string, number>>(() => zeros(catalogue));
  const [error, setError] = useState<string>();
  // Each photo gets a number; a count that arrives after a newer photo, or after
  // the customer chose to count it themselves, is ignored.
  const attempt = useRef(0);

  const lines = Object.values(counts).some((n) => n > 0) ? buildLines(catalogue, counts) : [];
  const total = lines.length > 0 ? orderTotalMinor(lines) : 0;

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    const mine = ++attempt.current;
    setError(undefined);
    const preview = URL.createObjectURL(file);
    setPhase({ kind: "counting", preview });
    try {
      const form = new FormData();
      form.set("standId", standId);
      form.set("photo", await shrinkPhoto(file), "basket.jpg");
      // The server gives up after about twenty seconds; this covers a dead signal.
      const response = await fetch("/api/count", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
      if (response.status === 422) {
        // A face in the photo: refused and not kept. Back to the camera.
        const refusal = await readError(response);
        if (mine !== attempt.current) return;
        setError(refusal);
        setPhase({ kind: "start" });
        return;
      }
      if (!response.ok) throw new Error(await readError(response));
      const reply = (await response.json()) as CountReply;
      if (mine !== attempt.current) return;
      setCounts(Object.fromEntries(catalogue.map((i) => [i.key, Math.min(MAX_QUANTITY, reply.counts[i.key] ?? 0)])));
      setPhase({ kind: "review", preview, reply, countId: reply.countId });
    } catch (e) {
      if (mine !== attempt.current) return;
      setCounts(zeros(catalogue));
      setError(`We could not count the photo (${e instanceof Error ? e.message : "unknown error"}). Enter your basket below, or try another photo.`);
      setPhase({ kind: "review", preview });
    }
  }

  function countMyself() {
    attempt.current++;
    setError(undefined);
    setCounts(zeros(catalogue));
    setPhase({ kind: "review" });
  }

  const change = (key: string, by: number) => setCounts((c) => ({ ...c, [key]: Math.min(MAX_QUANTITY, Math.max(0, (c[key] ?? 0) + by)) }));

  async function createOrder() {
    setError(undefined);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // The basket photo behind this order, kept as evidence for a refund request.
      body: JSON.stringify({ standId, counts, countId: phase.kind === "review" ? phase.countId : undefined }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const { orderId } = (await response.json()) as { orderId: string };
    return { orderId };
  }

  async function onApproved(orderId: string) {
    setPhase({ kind: "paying" });
    const response = await fetch(`/api/orders/${orderId}/capture`, { method: "POST" });
    if (!response.ok) {
      setError(`PayPal approved the payment, but it did not go through (${await readError(response)}). Nothing was taken; please try again.`);
      setPhase({ kind: "review" });
      return;
    }
    router.push(`/s/${standId}/receipt/${orderId}`);
  }

  const photoInput = (label: string, primary: boolean) => (
    <label
      className={
        primary
          ? "flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-ink bg-straw px-6 py-4 text-lg font-semibold text-ink shadow-tag active:translate-y-px"
          : "cursor-pointer font-semibold text-ink underline decoration-straw decoration-2 underline-offset-4"
      }
    >
      {primary && <CameraIcon />}
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        <div>
          <p className="eyebrow text-straw-ink">Honesty box · pay by phone</p>
          <h1 className="display text-2xl text-ink">{standName}</h1>
        </div>
      </header>

      <section aria-label="Today's prices" className="mt-6 -rotate-1 rounded-md border-[8px] border-wood bg-chalk px-5 pb-4 pt-3 font-hand text-chalk-line shadow-card">
        <p className="text-2xl font-bold">Today</p>
        <ul className="mt-1 space-y-0.5 text-lg">
          {catalogue.map((item) => (
            <li key={item.key} className="flex items-baseline gap-2">
              <span>{item.name}</span>
              <span className="flex-1 border-b-2 border-dotted border-chalk-line/30" />
              <span>{formatMoney(item.unitMinor, currency)}</span>
            </li>
          ))}
        </ul>
      </section>

      {phase.kind === "start" && (
        <section className="mt-8">
          {photoInput("Photograph your basket", true)}
          <p className="mt-3 text-center font-semibold text-ink">Just the basket: not yourself, and nobody else.</p>
          <p className="mt-2 text-center text-ink-2">We count it for you. You check the count, then pay with PayPal.</p>
          <p className="mt-4 text-center">
            <button type="button" onClick={countMyself} className="font-semibold text-ink underline decoration-line-2 decoration-2 underline-offset-4">
              Count it myself instead
            </button>
          </p>
          <p className="mt-6 text-center font-mono text-[0.6875rem] text-ink-3">
            Open any box or bag so each item shows. A photo with a person in it is refused and not kept. Others are kept for 30 days, in case you ask for a refund.
          </p>
        </section>
      )}

      {phase.kind === "counting" && (
        <section className="mt-8" aria-live="polite">
          <div className="relative overflow-hidden rounded-[22px] border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local photo preview, not a served image */}
            <img src={phase.preview} alt="Your basket" className="aspect-[4/3] w-full object-cover opacity-70" />
            <div className="absolute inset-0 animate-pulse bg-gradient-to-b from-transparent via-white/40 to-transparent" />
          </div>
          <p className="mt-4 text-center font-semibold text-ink">Counting your basket…</p>
          <p className="mt-2 text-center text-sm text-ink-2">This usually takes a few seconds.</p>
          <p className="mt-4 text-center">
            <button type="button" onClick={countMyself} className="font-semibold text-ink underline decoration-line-2 decoration-2 underline-offset-4">
              Count it myself instead
            </button>
          </p>
        </section>
      )}

      {phase.kind === "review" && (
        <section className="mt-8">
          {phase.preview && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local photo preview, not a served image */}
              <img src={phase.preview} alt="Your basket" className="h-16 w-16 rounded-xl border border-line object-cover" />
              <div className="text-sm text-ink-2">
                <p>Counted from your photo.</p>
                {photoInput("Retake the photo", false)}
              </div>
            </div>
          )}

          {phase.reply?.problem && (
            <p className="mt-4 rounded-2xl bg-straw-soft px-4 py-3 text-sm text-ink">
              The photo was hard to count: {phase.reply.problem}. Check the counts, or retake it.
            </p>
          )}

          <h2 className="display mt-6 text-2xl text-ink">Your basket</h2>
          <p className="mt-1 text-sm text-ink-2">You have the final word: change anything that is wrong.</p>

          <ul className="mt-4 divide-y divide-line border-y border-line">
            {catalogue.map((item) => {
              const counted = phase.reply?.counts[item.key];
              const sure = (phase.reply?.confidence[item.key] ?? 0) >= (phase.reply?.sureAt ?? 1);
              const changed = phase.reply !== undefined && counts[item.key] !== counted;
              const n = counts[item.key] ?? 0;
              const note = phase.reply?.notes[item.key];
              return (
                <li key={item.key} className={`flex items-center gap-3 py-3 ${n === 0 ? "opacity-70" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{item.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-ink-3">{formatMoney(item.unitMinor, currency)} each</span>
                      {phase.reply && n > 0 && !changed && (
                        <span className={sure ? "rounded-full bg-mint-soft px-2 py-0.5 font-medium text-mint-ink" : "rounded-full bg-straw-soft px-2 py-0.5 font-medium text-straw-ink"}>
                          {sure ? "sure" : "please check"}
                        </span>
                      )}
                      {changed && <span className="rounded-full bg-paper px-2 py-0.5 font-medium text-straw-ink">you changed this</span>}
                    </p>
                    {note && !changed && <p className="mt-1 text-sm text-straw-ink">{asSentence(note)}</p>}
                  </div>
                  <div className="flex items-center rounded-full border border-line-2">
                    <button type="button" onClick={() => change(item.key, -1)} className="grid h-11 w-11 place-items-center rounded-full text-xl text-ink active:bg-paper" aria-label={`One fewer: ${item.name}`}>
                      −
                    </button>
                    <span className="w-7 text-center font-mono text-lg font-semibold tabular-nums text-ink" aria-live="polite">
                      {n}
                    </span>
                    <button type="button" onClick={() => change(item.key, 1)} className="grid h-11 w-11 place-items-center rounded-full text-xl text-ink active:bg-paper" aria-label={`One more: ${item.name}`}>
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {phase.reply && phase.reply.unlisted.length > 0 && (
            <p className="mt-3 text-sm text-ink-3">
              Also in the photo, not on today&apos;s list, so not counted:{" "}
              {phase.reply.unlisted.map((u) => `${u.what}${u.count > 1 ? ` (${u.count})` : ""}`).join(", ")}.
            </p>
          )}

          <div className="mt-6 flex items-end justify-between gap-4">
            <p className="eyebrow text-ink-3">Total</p>
            <p className="display text-4xl tabular-nums text-ink">{formatMoney(total, currency)}</p>
          </div>

          {error && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-gap">{error}</p>}

          <div className="mt-5">
            {total > 0 ? (
              <PayPalButton
                clientId={paypalClientId}
                currency={currency}
                createOrder={createOrder}
                onApproved={onApproved}
                onCancelled={() => setError("You cancelled the payment. Nothing was taken.")}
                onFailed={(message) => setError(`The payment did not go through: ${message}.`)}
              />
            ) : (
              <p className="rounded-full bg-paper py-3 text-center font-semibold text-ink-3">Add what you are taking to pay</p>
            )}
            <p className="mt-2 text-center text-xs text-ink-4">PayPal wallet or card · sandbox only, no real money</p>
            {total > 0 && <IouForm standId={standId} counts={counts} countId={phase.countId} />}
          </div>
        </section>
      )}

      {phase.kind === "paying" && (
        <section className="mt-10 text-center" aria-live="polite">
          <p className="display text-2xl text-ink">Finishing your payment…</p>
          <p className="mt-2 text-ink-2">Please keep this page open.</p>
        </section>
      )}

      {error && phase.kind !== "review" && <p className="mt-4 rounded-2xl bg-gap-soft px-4 py-3 text-sm text-gap">{error}</p>}
    </div>
  );
}
