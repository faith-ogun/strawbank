// The PayPal webhook route's logic, apart from the network and the database so
// eval E4.4b can drive it. An event reaches the ledger only after PayPal
// itself confirms its signature; anything else is refused with nothing stored.

import type { WebhookEvent } from "./ledger";

export type WebhookDeps = {
  /** Asks PayPal whether these exact bytes and headers carry its signature. Throws if PayPal cannot be asked. */
  verify(rawBody: string, headers: Headers): Promise<boolean>;
  store: { apply(event: WebhookEvent): Promise<{ duplicate: boolean; changed: boolean }> };
};

export type WebhookReply = { status: number; body: Record<string, unknown> };

function parseEvent(rawBody: string): WebhookEvent | undefined {
  try {
    const value: unknown = JSON.parse(rawBody);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const { id, event_type, resource } = value as Record<string, unknown>;
    if (typeof id !== "string" || typeof event_type !== "string") return undefined;
    if (typeof resource !== "object" || resource === null || Array.isArray(resource)) return undefined;
    return { id, event_type, resource: resource as Record<string, unknown> };
  } catch {
    return undefined;
  }
}

/**
 * 200 once the event is in the ledger (or was already); 400 for a body that is
 * not a PayPal event or a signature PayPal does not confirm; 503 and 500 when
 * PayPal or the database cannot be reached, so PayPal sends the event again.
 */
export async function handlePayPalWebhook(rawBody: string, headers: Headers, deps: WebhookDeps): Promise<WebhookReply> {
  const event = parseEvent(rawBody);
  if (!event) return { status: 400, body: { error: "not a PayPal webhook event" } };

  let verified: boolean;
  try {
    verified = await deps.verify(rawBody, headers);
  } catch (error) {
    console.error(`webhook ${event.id}: could not ask PayPal to verify it`, error);
    return { status: 503, body: { error: "could not verify the signature yet" } };
  }
  if (!verified) {
    console.warn(`webhook ${event.id} (${event.event_type}): signature not confirmed by PayPal; ignored`);
    return { status: 400, body: { error: "signature not confirmed" } };
  }

  try {
    const { duplicate, changed } = await deps.store.apply(event);
    return { status: 200, body: { received: event.id, duplicate, changed } };
  } catch (error) {
    console.error(`webhook ${event.id}: could not record it`, error);
    return { status: 500, body: { error: "could not record the event" } };
  }
}
