import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RefundDecision } from "@/components/grower/refund-decision";
import { findStand } from "@/lib/demo-stand";
import { formatMoney } from "@/lib/money";
import { type RefundRequest, requestsForStand } from "@/lib/refund-store";
import { currentGrower } from "@/lib/session";

// F4 human gate. Requests over the limit, contradicted by the photo, or
// uncertain wait here with the photo and the agent's reading. Below them, what
// was settled, and by whom.

export const metadata: Metadata = { title: "Strawbank · refunds" };

const STATUS: Record<string, string> = {
  COMPLETED: "refunded",
  PENDING: "refund on its way",
  FAILED: "PayPal refused the refund",
  DECLINED: "declined",
  NONE: "nothing to refund",
};

const shortName = (name: string) => name.replace(/, each$/i, "");

function Claim({ request }: { request: RefundRequest }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {request.lines.map((line) => (
        <li key={line.key} className="flex justify-between gap-3">
          <span className="text-ink">{shortName(line.name)}</span>
          <span className="font-mono text-ink-2">
            charged {line.quantity} · says took {request.claimed[line.key]}
            {request.recount ? ` · photo shows ${request.recount[line.key] ?? 0}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function Requests() {
  const grower = await currentGrower();
  const found = grower?.standId ? findStand(grower.standId) : undefined;
  if (!found) redirect("/grower");
  const all = (await requestsForStand(found.stand.id)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const waiting = all.filter((r) => r.status === "WAITING");
  const settled = all.filter((r) => r.status !== "WAITING").slice(0, 20);
  const limit = formatMoney(found.stand.refundLimitMinor, found.stand.currency);
  return (
    <>
      <p className="mt-4 text-ink-2">
        The agent refunds on its own only when your customer&apos;s basket photo backs the claim and it is {limit} or less. Everything else waits here for you.
      </p>
      <h2 className="eyebrow mt-6 text-ink-3">Waiting for you</h2>
      {waiting.length === 0 && <p className="mt-2 rounded-2xl bg-paper px-4 py-3 text-sm text-ink-2">Nothing is waiting.</p>}
      {waiting.map((request) => (
        <article key={request.requestId} className="mt-3 rounded-3xl border border-straw bg-canvas p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold text-ink">{formatMoney(request.amountMinor, request.currency)} asked back</p>
            <p className="text-xs text-ink-3">{request.date}</p>
          </div>
          <p className="mt-1 text-sm text-straw-ink">Why it waits: {request.reasons.join("; ")}.</p>
          <Claim request={request} />
          {request.countId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/photos/basket/${request.countId}`} alt="The customer's basket photo" className="mt-3 w-full rounded-2xl border border-line" />
          )}
          <p className="mt-2 font-mono text-[0.6875rem] text-ink-3">PayPal order {request.orderId} · capture {request.captureId}</p>
          <RefundDecision requestId={request.requestId} amount={formatMoney(request.amountMinor, request.currency)} />
        </article>
      ))}
      <h2 className="eyebrow mt-8 text-ink-3">Settled</h2>
      {settled.length === 0 && <p className="mt-2 text-sm text-ink-3">None yet.</p>}
      <ul className={settled.length > 0 ? "mt-2 divide-y divide-line rounded-3xl border border-line bg-canvas px-4" : "hidden"}>
        {settled.map((request) => (
          <li key={request.requestId} className="py-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-ink">
                {request.amountMinor > 0 ? formatMoney(request.amountMinor, request.currency) : "-"} · {STATUS[request.status] ?? request.status}
              </span>
              <span className="text-ink-3">{request.decidedBy === "agent" ? "by the agent" : request.decidedBy === "grower" ? "by you" : ""}</span>
            </div>
            <Claim request={request} />
            <p className="mt-1 font-mono text-[0.6875rem] text-ink-3">
              {request.date} · order {request.orderId}
              {request.refund?.paypalRefundId ? ` · PayPal refund ${request.refund.paypalRefundId}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function RefundsPage() {
  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="flex items-center gap-3">
        <Link href="/grower" aria-label="Back to your stand">
          <Image src="/brand/strawbank-mark.png" alt="" width={40} height={45} priority />
        </Link>
        <div>
          <p className="eyebrow text-straw-ink">Refunds</p>
          <h1 className="display text-2xl text-ink">Customers&apos; claims</h1>
        </div>
      </header>
      <Suspense fallback={<p className="mt-6 text-ink-3">Opening…</p>}>
        <Requests />
      </Suspense>
    </div>
  );
}
