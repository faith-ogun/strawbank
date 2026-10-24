import { Suspense } from "react";
import { Placeholder } from "@/components/placeholder";

// F2 step 5 and F4. The receipt, with a "something's wrong" link that starts a
// refund request. Refund amounts come from src/lib/refunds.ts.
export default function ReceiptPage({ params }: PageProps<"/s/[standId]/receipt/[orderId]">) {
  return (
    <Placeholder flow="F2 and F4. Receipt and refund request" title="Receipt">
      <Suspense fallback={<p>Loading the receipt...</p>}>
        {params.then(({ orderId }) => (
          <p>
            Order <code>{orderId}</code>: the lines paid for, and a &quot;something&apos;s wrong&quot; link.
          </p>
        ))}
      </Suspense>
    </Placeholder>
  );
}
