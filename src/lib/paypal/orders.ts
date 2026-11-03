// F2 steps 4 and 5 against PayPal: the order body from src/lib/orders.ts goes to
// Orders v2 through the PayPal Server SDK, and the capture comes back in minor
// units. No amount is worked out here: the body is translated field for field
// (eval E4.1c checks that), and amounts coming back are parsed, not computed.
// Written with the APIMatic Context Plugin's TypeScript skills (calling
// endpoints, models, error handling).

import {
  ApiError,
  CheckoutPaymentIntent,
  CustomError,
  ItemCategory,
  OrdersController,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
} from "@paypal/paypal-server-sdk";
import type { Money, Order, OrderRequest } from "@paypal/paypal-server-sdk";
import { type Currency, type PayPalAmount, fromPayPalAmount } from "../money";
import type { CreateOrderBody } from "../orders";
import { paypalClient } from "./client";

/** Where PayPal sends the customer after they approve or cancel. */
export type Experience = { returnUrl: string; cancelUrl: string };

/** A PayPal failure, in words a route can return. Never carries credentials. */
export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly debugId?: string,
    readonly issue?: string,
  ) {
    super(message);
  }
}

const money = (a: PayPalAmount): Money => ({ currencyCode: a.currency_code, value: a.value });

/** The SDK's camelCase request, field for field from the tested wire body. */
export function toOrderRequest(body: CreateOrderBody, experience?: Experience): OrderRequest {
  const unit = body.purchase_units[0];
  return {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        referenceId: unit.reference_id,
        ...(unit.custom_id && { customId: unit.custom_id }),
        amount: {
          ...money(unit.amount),
          breakdown: { itemTotal: money(unit.amount.breakdown.item_total) },
        },
        items: unit.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unitAmount: money(item.unit_amount),
          category: ItemCategory.PhysicalGoods,
        })),
      },
    ],
    ...(experience && {
      paymentSource: {
        paypal: {
          experienceContext: {
            brandName: "Strawbank",
            returnUrl: experience.returnUrl,
            cancelUrl: experience.cancelUrl,
            userAction: PaypalExperienceUserAction.PayNow,
            shippingPreference: PaypalWalletContextShippingPreference.NoShipping,
          },
        },
      },
    }),
  };
}

function orders(): OrdersController {
  return new OrdersController(paypalClient());
}

/** Every SDK failure becomes a PayPalError; anything else (network, timeout) is rethrown as it is. */
function translate(error: unknown): never {
  if (error instanceof CustomError) {
    const body = error.result;
    throw new PayPalError(body?.message ?? `PayPal returned ${error.statusCode}`, error.statusCode, body?.debug_id, body?.details?.[0]?.issue);
  }
  if (error instanceof ApiError) throw new PayPalError(`PayPal returned ${error.statusCode}`, error.statusCode);
  throw error;
}

export type CreatedOrder = { orderId: string; status: string; approveUrl: string };

/**
 * Orders v2 create. `requestId` goes in PayPal-Request-Id, so sending the same
 * basket twice returns the same order instead of making a second one.
 */
export async function createPayPalOrder(body: CreateOrderBody, experience: Experience, requestId: string): Promise<CreatedOrder> {
  let order: Order;
  try {
    ({ result: order } = await orders().createOrder({
      body: toOrderRequest(body, experience),
      paypalRequestId: requestId,
      prefer: "return=minimal",
    }));
  } catch (error) {
    translate(error);
  }
  // With a PayPal payment source the approval link is "payer-action"; older flows call it "approve".
  const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!order.id || !order.status || !approve) throw new PayPalError("PayPal returned an order without an approval link", 502);
  return { orderId: order.id, status: order.status, approveUrl: approve.href };
}

export type CapturedOrder = {
  orderId: string;
  orderStatus: string;
  captureId: string;
  captureStatus: string;
  amountMinor: number;
};

/**
 * Orders v2 capture, after the customer has approved. The request id is derived
 * from the order, so a repeated capture call returns the first capture rather
 * than charging again.
 */
export async function capturePayPalOrder(orderId: string, currency: Currency): Promise<CapturedOrder> {
  let order: Order;
  try {
    ({ result: order } = await orders().captureOrder({
      id: orderId,
      paypalRequestId: `capture-${orderId}`,
      prefer: "return=representation",
    }));
  } catch (error) {
    translate(error);
  }
  const capture = order.purchaseUnits?.[0]?.payments?.captures?.[0];
  if (!order.status || !capture?.id || !capture.status || !capture.amount) {
    throw new PayPalError("PayPal returned a capture without its id, status or amount", 502);
  }
  return {
    orderId,
    orderStatus: order.status,
    captureId: capture.id,
    captureStatus: capture.status,
    amountMinor: fromPayPalAmount({ currency_code: capture.amount.currencyCode, value: capture.amount.value }, currency),
  };
}

/** Orders v2 get: the order as PayPal holds it, for checks and the receipt. */
export async function getPayPalOrder(orderId: string): Promise<Order> {
  try {
    return (await orders().getOrder({ id: orderId })).result;
  } catch (error) {
    translate(error);
  }
}
