// Asks PayPal whether a webhook really came from it:
// POST /v1/notifications/verify-webhook-signature. The Server SDK has no
// webhooks controller, so this is a plain request that borrows the SDK's
// OAuth token.
//
// The event must go to PayPal exactly as it arrived: parsing it and writing
// it out again can change the bytes the signature covers, so the raw body is
// placed into the request as it is. The caller has already checked that the
// raw body is a JSON object.

import type { OAuthToken } from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";
import { PAYPAL_API_BASE } from "./config";

const HEADERS = {
  auth_algo: "paypal-auth-algo",
  cert_url: "paypal-cert-url",
  transmission_id: "paypal-transmission-id",
  transmission_sig: "paypal-transmission-sig",
  transmission_time: "paypal-transmission-time",
} as const;

const TIMEOUT_MS = 10_000;

let token: OAuthToken | undefined;

export async function verifyWithPayPal(rawBody: string, headers: Headers): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not set: the id PayPal gave the webhook pointed at /api/webhooks/paypal");

  const fields: string[] = [];
  for (const [field, header] of Object.entries(HEADERS)) {
    const value = headers.get(header);
    if (!value) return false;
    fields.push(`${JSON.stringify(field)}:${JSON.stringify(value)}`);
  }
  const body = `{${fields.join(",")},"webhook_id":${JSON.stringify(webhookId)},"webhook_event":${rawBody}}`;

  token = await paypalClient().clientCredentialsAuthManager.updateToken(token);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`verify-webhook-signature answered ${response.status}`);
  const result = (await response.json()) as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}
