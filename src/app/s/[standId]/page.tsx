import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StandShop } from "@/components/stand/stand-shop";
import { standToday } from "@/lib/days";
import { paypalCredentials } from "@/lib/paypal/config";

// F2. The customer scans the stand's QR code, photographs the basket, checks
// the count and pays. Prices come from the server; totals from
// src/lib/orders.ts, never the model.

export const metadata: Metadata = { title: "Strawbank · pay at the stand" };

async function Stand({ params }: { params: PageProps<"/s/[standId]">["params"] }) {
  const { standId } = await params;
  const found = await standToday(standId);
  if (!found) notFound();
  return (
    <StandShop
      standId={found.stand.id}
      standName={found.stand.name}
      currency={found.stand.currency}
      catalogue={found.catalogue}
      // The client id is public by design: the PayPal button needs it in the browser.
      paypalClientId={paypalCredentials().clientId}
    />
  );
}

export default function StandPage({ params }: PageProps<"/s/[standId]">) {
  return (
    <main className="landing min-h-svh flex-1">
      <Suspense fallback={<p className="mx-auto max-w-[480px] px-4 pt-10 text-ink-3">Opening the stand…</p>}>
        <Stand params={params} />
      </Suspense>
      <p className="mx-auto max-w-[480px] px-4 pb-10 text-center text-sm text-ink-3">
        Run a stand?{" "}
        <Link href="/grower" className="font-semibold text-ink underline underline-offset-4">
          See the grower&apos;s side
        </Link>
      </p>
    </main>
  );
}
