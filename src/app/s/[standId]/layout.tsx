import Link from "next/link";
import { Suspense } from "react";
import { currentGrower } from "@/lib/session";

// Every customer page (the stand, the receipt, the IOU) says who you are here,
// in the customer's colour (9 Nov: in the dry run, playing both sides, it was
// not clear which side a page was). Someone who is also signed in as the grower,
// such as a judge trying both sides, gets a way back; a customer never sees it.

async function GrowerSwitch() {
  const grower = await currentGrower();
  if (!grower?.standId) return null;
  return (
    <Link href="/grower" className="whitespace-nowrap rounded-full bg-ink px-3 py-1 font-semibold text-white">
      Switch to grower →
    </Link>
  );
}

export default function StandLayout({ children }: LayoutProps<"/s/[standId]">) {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-straw bg-straw-soft">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-straw px-2.5 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink">Customer</span>
            <span className="hidden text-ink-2 min-[400px]:inline">Buying at the stand</span>
          </span>
          <Suspense fallback={null}>
            <GrowerSwitch />
          </Suspense>
        </div>
      </div>
      {children}
    </>
  );
}
