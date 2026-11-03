// Log in with PayPal, for growers (sandbox): send them to PayPal's consent
// page, swap the code PayPal returns for an access token, and read who they
// are from the userinfo endpoint. Endpoints from PayPal's "Integrate Log in
// with PayPal" page (read 3 Nov). The Server SDK only covers client
// credentials, so these are plain requests.

import { randomBytes } from "node:crypto";
import { appUrl } from "../app-url";
import { PAYPAL_API_BASE, paypalCredentials } from "./config";

const AUTHORIZE_URL = "https://www.sandbox.paypal.com/connect";
const SCOPES = "openid profile email";
const TIMEOUT_MS = 10_000;

/** Where PayPal sends the grower back. Must match the app's Log in with PayPal "Return URL" exactly. */
export function returnUrl(): string {
  return `${appUrl()}/api/auth/paypal/callback`;
}

export const newState = () => randomBytes(24).toString("base64url");

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    flowEntry: "static",
    client_id: paypalCredentials().clientId,
    response_type: "code",
    scope: SCOPES,
    redirect_uri: returnUrl(),
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

export type PayPalPerson = { accountId: string; name: string };

export async function personFromCode(code: string): Promise<PayPalPerson> {
  const { clientId, clientSecret } = paypalCredentials();
  const tokenResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error(`PayPal refused the sign-in code (${tokenResponse.status})`);
  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) throw new Error("PayPal sent no access token");

  const infoResponse = await fetch(`${PAYPAL_API_BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!infoResponse.ok) throw new Error(`PayPal did not say who signed in (${infoResponse.status})`);
  const info = (await infoResponse.json()) as { user_id?: string; payer_id?: string; name?: string };
  const accountId = info.payer_id ?? info.user_id?.split("/").pop();
  if (!accountId) throw new Error("PayPal's userinfo has no account id");
  return { accountId, name: info.name?.trim() || "Grower" };
}
