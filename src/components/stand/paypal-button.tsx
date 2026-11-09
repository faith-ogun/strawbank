"use client";

// The PayPal button, from the PayPal JS SDK v6 (sandbox only). The script loads
// once; the button shows only when PayPal says it can be used here. A click
// starts the payment at once, with the order still being created, so phones
// do not block PayPal's window as an unrequested popup.
//
// Setting PayPal up can fail on a phone for a moment (9 Nov: an iPhone in
// Chrome showed "not available" while the same page worked elsewhere), so it is
// tried three times before giving up, the customer can press "Try again", and
// the reason is sent to the service's log through /api/paypal-button.

import type { OneTimePaymentSession } from "@paypal/paypal-js/sdk-v6";
import { useEffect, useRef, useState } from "react";

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";

/** Waits before each try: at once, then after 1.5 s, then after 4 s more. */
const WAITS_MS = [0, 1500, 4000];

type Step = "script" | "instance" | "eligibility" | "not-eligible" | "session";

class SetUpFailed extends Error {
  constructor(
    readonly step: Step,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message || cause.name : String(cause));
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function report(failure: SetUpFailed, attempts: number) {
  fetch("/api/paypal-button", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ step: failure.step, message: failure.message.slice(0, 300), attempts }),
    keepalive: true,
  }).catch(() => undefined);
}

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

/** One try at loading PayPal and asking whether its button can be used here. */
async function setUp(clientId: string, currency: string) {
  await loadSdk().catch((error: unknown) => {
    throw new SetUpFailed("script", error);
  });
  if (!window.paypal) throw new SetUpFailed("script", "the script loaded, but PayPal is not on the page");
  const sdk = await window.paypal
    .createInstance({
      clientId,
      components: ["paypal-payments"],
      pageType: "checkout",
      locale: "en-IE",
      testBuyerCountry: "IE",
    })
    .catch((error: unknown) => {
      throw new SetUpFailed("instance", error);
    });
  const methods = await sdk.findEligibleMethods({ currencyCode: currency }).catch((error: unknown) => {
    throw new SetUpFailed("eligibility", error);
  });
  if (!methods.isEligible("paypal")) throw new SetUpFailed("not-eligible", "PayPal says its button cannot be used here");
  return sdk;
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
  const [round, setRound] = useState(0);
  const session = useRef<OneTimePaymentSession | undefined>(undefined);
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    let gone = false;
    (async () => {
      let failure = new SetUpFailed("script", "not tried");
      let attempts = 0;
      for (const ms of WAITS_MS) {
        if (ms > 0) await wait(ms);
        if (gone) return;
        attempts++;
        try {
          const sdk = await setUp(clientId, currency);
          if (gone) return;
          session.current = sdk.createPayPalOneTimePaymentSession({
            onApprove: (data) => latest.current.onApproved(data.orderId),
            onCancel: () => latest.current.onCancelled(),
            onError: (error) => latest.current.onFailed(error.message || "PayPal reported an error"),
          });
          setState("ready");
          return;
        } catch (error) {
          failure = error instanceof SetUpFailed ? error : new SetUpFailed("session", error);
        }
      }
      if (gone) return;
      setState("unavailable");
      report(failure, attempts);
    })();
    return () => {
      gone = true;
      session.current?.destroy();
      session.current = undefined;
    };
  }, [clientId, currency, round]);

  const tryAgain = () => {
    setState("loading");
    setRound((n) => n + 1);
  };

  const start = () => {
    if (!session.current) return;
    session.current.start({ presentationMode: "auto" }, latest.current.createOrder()).catch((error: unknown) => {
      latest.current.onFailed(error instanceof Error ? error.message : "the payment could not start");
    });
  };

  if (state === "unavailable") {
    return (
      <div className="rounded-2xl bg-gap-soft px-4 py-3 text-sm text-gap">
        <p>PayPal did not load on this phone. Check you are online and try again, or leave an IOU below.</p>
        <button type="button" onClick={tryAgain} className="mt-2 font-semibold underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }
  return (
    <div className="min-h-[50px]">
      {state === "loading" && <div className="h-[50px] animate-pulse rounded-full bg-paper" aria-label="Loading PayPal" />}
      <paypal-button type="pay" className="block w-full" hidden={state !== "ready"} onClick={start} />
    </div>
  );
}
