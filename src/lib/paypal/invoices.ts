// The IOU against PayPal: Invoicing v2 (/v2/invoicing/invoices). The Server
// SDK 2.5.0 has no invoicing controller, so these are plain requests that
// borrow the SDK's OAuth token, as the webhook check does. Code calls them on
// a customer's or grower's request; the model never does, and the agent's
// toolkit allowlist does not include them.

import type { OAuthToken } from "@paypal/paypal-server-sdk";
import type { InvoiceBody, InvoiceStatus } from "../ious";
import { type Currency, toDecimal, toMinor } from "../money";
import { paypalClient } from "./client";
import { PAYPAL_API_BASE } from "./config";
import { PayPalError } from "./orders";

const TIMEOUT_MS = 15_000;

let token: OAuthToken | undefined;

type Answer<T> = { body: T; status: number; debugId?: string };

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, requestId?: string): Promise<Answer<T>> {
  token = await paypalClient().clientCredentialsAuthManager.updateToken(token);
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Makes a repeated create return the same invoice instead of a second one.
      ...(requestId && { "PayPal-Request-Id": requestId }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const debugId = response.headers.get("paypal-debug-id") ?? undefined;
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const error = parsed as { message?: string; name?: string; details?: { issue?: string; description?: string }[] };
    const detail = error.details?.[0];
    throw new PayPalError(detail?.description ?? error.message ?? `PayPal Invoicing answered ${response.status}`, response.status, debugId, detail?.issue ?? error.name);
  }
  return { body: parsed as T, status: response.status, debugId };
}

type Invoice = {
  id: string;
  status: InvoiceStatus;
  amount?: { currency_code: string; value: string };
  links?: { href: string; rel: string }[];
};

export type CreatedInvoice = { invoiceId: string; status: InvoiceStatus; totalMinor: number; debugId?: string };

/** A draft invoice; PayPal works out its total, and the caller checks it against code's. */
export async function createInvoice(body: InvoiceBody, requestId: string, currency: Currency): Promise<CreatedInvoice> {
  const { body: invoice, debugId } = await call<Invoice>("POST", "/v2/invoicing/invoices", body, requestId);
  if (!invoice.id) throw new PayPalError("PayPal made no invoice", 502, debugId);
  if (invoice.amount && invoice.amount.currency_code !== currency) throw new PayPalError("PayPal invoiced in another currency", 502, debugId);
  return { invoiceId: invoice.id, status: invoice.status, totalMinor: invoice.amount ? toMinor(invoice.amount.value) : -1, debugId };
}

/** Sends it: PayPal emails the customer a link to pay. Returns that link. */
export async function sendInvoice(invoiceId: string): Promise<{ payUrl?: string; status: number; debugId?: string }> {
  const { body, status, debugId } = await call<{ href?: string; links?: { href: string; rel: string }[] }>(
    "POST",
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    { send_to_recipient: true, send_to_invoicer: false },
    `send-${invoiceId}`,
  );
  const payUrl = body.links?.find((l) => l.rel === "payer-view")?.href ?? body.href;
  return { payUrl, status, debugId };
}

export async function remindInvoice(invoiceId: string, standName: string): Promise<{ status: number; debugId?: string }> {
  const { status, debugId } = await call("POST", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`, {
    subject: `A reminder from ${standName}`,
    note: "Your IOU from the honesty box is still open. Thank you for paying when you can.",
    send_to_recipient: true,
    send_to_invoicer: false,
  });
  return { status, debugId };
}

/** The grower was paid in cash: recorded in PayPal, so PayPal's record stays complete. */
export async function recordCash(invoiceId: string, totalMinor: number, currency: Currency, date: string): Promise<{ paymentId?: string; status: number; debugId?: string }> {
  const { body, status, debugId } = await call<{ payment_id?: string }>(
    "POST",
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`,
    { method: "CASH", payment_date: date, amount: { currency_code: currency, value: toDecimal(totalMinor) }, note: "Paid in cash at the stand" },
    `cash-${invoiceId}`,
  );
  return { paymentId: body.payment_id, status, debugId };
}

export async function cancelInvoice(invoiceId: string): Promise<{ status: number; debugId?: string }> {
  const { status, debugId } = await call("POST", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    subject: "IOU cancelled",
    note: "The grower has cancelled this IOU. Nothing is owed.",
    send_to_recipient: true,
    send_to_invoicer: false,
  });
  return { status, debugId };
}

/** Deletes a draft that was never sent. */
export async function deleteDraft(invoiceId: string): Promise<void> {
  await call("DELETE", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
}

export async function getInvoice(invoiceId: string): Promise<{ status: InvoiceStatus; debugId?: string }> {
  const { body, debugId } = await call<Invoice>("GET", `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
  return { status: body.status, debugId };
}
