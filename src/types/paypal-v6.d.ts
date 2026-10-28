// The PayPal JS SDK v6 is loaded as a script, so its global and its
// <paypal-button> element are declared here, typed by @paypal/paypal-js.

import type { PayPalV6Namespace } from "@paypal/paypal-js/sdk-v6";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  interface Window {
    paypal?: PayPalV6Namespace;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: "buynow" | "checkout" | "donate" | "pay" | "subscribe";
        class?: string;
      };
    }
  }
}
