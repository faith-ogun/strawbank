"use client";

// The PayPal button, from the PayPal JS SDK v6 (sandbox only). The script loads
// once; the button shows only when PayPal says it can be used here. A click
// starts the payment at once, with the order still being created, so phones
// do not block PayPal's window as an unrequested popup.

import type { OneTimePaymentSession } from "@paypal/paypal-js/sdk-v6";
import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";

let loading: Promise<void> | undefined;

function loadSdk(): Promise<void> {
  if (window.paypal) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      reject(new Error("PayPal could not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type PayPalHandlers = {
  /** Creates the order on our server and returns its PayPal id. */
  createOrder: () => Promise<{ orderId: string }>;
  onApproved: (orderId: string) => Promise<void>;
  onCancelled: () => void;
  onFailed: (message: string) => void;
};

export function PayPalButton({ clientId, currency, ...handlers }: { clientId: string; currency: string } & PayPalHandlers) {
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const session = useRef<OneTimePaymentSession | undefined>(undefined);
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    let gone = false;
    (async () => {
      await loadSdk();
      const sdk = await window.paypal!.createInstance({
        clientId,
        components: ["paypal-payments"],
        pageType: "checkout",
        locale: "en-IE",
        testBuyerCountry: "IE",
      });
      const methods = await sdk.findEligibleMethods({ currencyCode: currency });
      if (gone) return;
      if (!methods.isEligible("paypal")) return setState("unavailable");
      session.current = sdk.createPayPalOneTimePaymentSession({
        onApprove: (data) => latest.current.onApproved(data.orderId),
        onCancel: () => latest.current.onCancelled(),
        onError: (error) => latest.current.onFailed(error.message || "PayPal reported an error"),
      });
      setState("ready");
    })().catch(() => {
      if (!gone) setState("unavailable");
    });
    return () => {
      gone = true;
      session.current?.destroy();
      session.current = undefined;
    };
  }, [clientId, currency]);

  const start = () => {
    if (!session.current) return;
    session.current.start({ presentationMode: "auto" }, latest.current.createOrder()).catch((error: unknown) => {
      latest.current.onFailed(error instanceof Error ? error.message : "the payment could not start");
    });
  };

  if (state === "unavailable") {
    return <p className="rounded-2xl bg-gap-soft px-4 py-3 text-sm text-gap">PayPal is not available right now. Please try again in a moment.</p>;
  }
  return (
    <div className="min-h-[50px]">
      {state === "loading" && <div className="h-[50px] animate-pulse rounded-full bg-paper" aria-label="Loading PayPal" />}
      <paypal-button type="pay" className="block w-full" hidden={state !== "ready"} onClick={start} />
    </div>
  );
}
