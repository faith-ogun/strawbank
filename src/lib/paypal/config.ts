// Sandbox only (hard rule): there is deliberately no setting that points this
// app at live PayPal.
export const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

export function paypalCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set (sandbox app credentials)");
  }
  return { clientId, clientSecret };
}
