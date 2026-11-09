import { Suspense } from "react";
import { GrowerNav } from "@/components/grower/grower-nav";
import { requestsForStand } from "@/lib/refund-store";
import { currentGrower } from "@/lib/session";

// Every grower page carries the grower's navigation once they are signed in
// (9 Nov: the dry run found no way between pages but the browser's back button).

async function NavIfSignedIn() {
  const grower = await currentGrower();
  if (!grower?.standId) return null;
  const waiting = (await requestsForStand(grower.standId).catch(() => [])).filter((r) => r.status === "WAITING").length;
  return <GrowerNav standId={grower.standId} refundsWaiting={waiting} />;
}

export default function GrowerLayout({ children }: LayoutProps<"/grower">) {
  return (
    <>
      <Suspense fallback={null}>
        <NavIfSignedIn />
      </Suspense>
      {/* Room for the phone's bottom bar, so it never covers a page's last button. */}
      <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
    </>
  );
}
