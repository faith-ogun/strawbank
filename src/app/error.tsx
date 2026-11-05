"use client";

import { useEffect } from "react";
import { PlainPage } from "@/components/plain-page";

// Shown when a page fails on the server, for example if PayPal does not answer
// while a receipt loads. Without it, the visitor gets Next's bare error text.
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PlainPage eyebrow="Something went wrong" title="That did not load">
      <p>Strawbank could not load this page just now. Please try again in a moment.</p>
      <p>If you have just paid, your PayPal account has its own record of the payment.</p>
      <button type="button" onClick={() => retry()} className="rounded-full bg-ink px-6 py-3 font-semibold text-canvas">
        Try again
      </button>
    </PlainPage>
  );
}
