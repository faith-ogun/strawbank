// Disputes against PayPal: /v1/customer/disputes. The Server SDK 2.5.0 has no
// disputes controller and the Agent Toolkit cannot submit evidence, so these
// are plain requests that borrow the SDK's OAuth token. The grower presses
// every button; the agent and the model have no part in disputes.

import type { OAuthToken } from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";
import { PAYPAL_API_BASE } from "./config";
import { PayPalError } from "./orders";

const TIMEOUT_MS = 20_000;
let token: OAuthToken | undefined;

type Answer<T> = { body: T; status: number; debugId?: string };

async function call<T>(method: "GET" | "POST", path: string, body?: BodyInit, json = true): Promise<Answer<T>> {
  token = await paypalClient().clientCredentialsAuthManager.updateToken(token);
  const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
    method,
    // A multipart body sets its own Content-Type, with the boundary.
    headers: { Authorization: `Bearer ${token.accessToken}`, ...(json && body !== undefined && { "Content-Type": "application/json" }) },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const debugId = response.headers.get("paypal-debug-id") ?? undefined;
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const error = parsed as { message?: string; name?: string; details?: { issue?: string; description?: string }[] };
    const detail = error.details?.[0];
    throw new PayPalError(detail?.description ?? error.message ?? `PayPal Disputes answered ${response.status}`, response.status, debugId, detail?.issue ?? error.name);
  }
  return { body: parsed as T, status: response.status, debugId };
}

type Amount = { currency_code: string; value: string };

export type DisputeSummary = { dispute_id: string; reason?: string; status?: string; dispute_amount?: Amount; create_time?: string; update_time?: string };

export type Dispute = DisputeSummary & {
  dispute_life_cycle_stage?: string;
  seller_response_due_date?: string;
  disputed_transactions?: { seller_transaction_id?: string; buyer_transaction_id?: string; custom?: string }[];
  evidences?: { evidence_type?: string; source?: string }[];
  links?: { rel: string; href: string; method?: string }[];
};

export async function listDisputes(): Promise<{ disputes: DisputeSummary[]; debugId?: string }> {
  const { body, debugId } = await call<{ items?: DisputeSummary[] }>("GET", "/v1/customer/disputes?page_size=50");
  return { disputes: body.items ?? [], debugId };
}

export async function getDispute(disputeId: string): Promise<{ dispute: Dispute; debugId?: string }> {
  const { body, debugId } = await call<Dispute>("GET", `/v1/customer/disputes/${encodeURIComponent(disputeId)}`);
  return { dispute: body, debugId };
}

/** The evidence types PayPal asked this seller for. */
export function requestedFromSeller(dispute: Dispute): string[] {
  return (dispute.evidences ?? []).filter((e) => e.source === "REQUESTED_FROM_SELLER" && e.evidence_type).map((e) => e.evidence_type!);
}

/** True when PayPal lists the action among the dispute's links, which is when it is allowed. */
export function canDo(dispute: Dispute, rel: "provide_evidence" | "accept_claim" | "require_evidence"): boolean {
  return (dispute.links ?? []).some((l) => l.rel === rel);
}

/** Sends the stand's evidence: code's notes, and the basket photo if the stand still holds it. */
export async function provideEvidence(
  disputeId: string,
  evidence: { type: string; notes: string },
  photo?: { data: Uint8Array; contentType: string },
): Promise<{ status: number; debugId?: string }> {
  const form = new FormData();
  form.set("input", new Blob([JSON.stringify({ evidences: [{ evidence_type: evidence.type, notes: evidence.notes }] })], { type: "application/json" }));
  if (photo) form.set("file1", new Blob([Buffer.from(photo.data)], { type: photo.contentType }), `basket.${photo.contentType === "image/png" ? "png" : "jpg"}`);
  const { status, debugId } = await call("POST", `/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`, form, false);
  return { status, debugId };
}

/** The grower refunds instead: PayPal closes the dispute in the customer's favour and refunds them. */
export async function acceptClaim(disputeId: string, note: string): Promise<{ status: number; debugId?: string }> {
  const { status, debugId } = await call("POST", `/v1/customer/disputes/${encodeURIComponent(disputeId)}/accept-claim`, JSON.stringify({ note }));
  return { status, debugId };
}

/** Sandbox only: moves a dispute under review to "waiting for the seller", so evidence can be tried. */
export async function requireSellerEvidence(disputeId: string): Promise<{ status: number; debugId?: string }> {
  const { status, debugId } = await call("POST", `/v1/customer/disputes/${encodeURIComponent(disputeId)}/require-evidence`, JSON.stringify({ action: "SELLER_EVIDENCE" }));
  return { status, debugId };
}
