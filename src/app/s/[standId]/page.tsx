import { Suspense } from "react";
import { Placeholder } from "@/components/placeholder";

// F2. The customer scans the stand's QR code, photographs the basket, checks
// the count and pays. Totals come from src/lib/orders.ts, never the model.
export default function StandPage({ params }: PageProps<"/s/[standId]">) {
  return (
    <Placeholder flow="F2. A customer buys" title="Today at the stand">
      <Suspense fallback={<p>Loading the stand...</p>}>
        {params.then(({ standId }) => (
          <p>
            Stand <code>{standId}</code>: today&apos;s prices, the basket photo, the count with plus and minus buttons,
            and PayPal checkout.
          </p>
        ))}
      </Suspense>
    </Placeholder>
  );
}
