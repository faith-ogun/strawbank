// F4 against PayPal: the RefundGateway that src/lib/refunds.ts's issueRefund
// calls, carried out with the Agent Toolkit's create_refund (Payments v2,
// partial refunds). The amount is the one code decided; the model never
// supplies it (eval E4.2c checks what is sent and how the reply is read).

import { type AgentToolName, runAgentTool } from "../../agent/tools";
import { paypalToolkitTools } from "../../agent/toolkit";
import { paypalAmount } from "../money";
import { type RefundGateway, RefundRejected } from "../refunds";

type Executable = { execute?: (args: never, options?: never) => unknown };
type RefundTools = Partial<Record<AgentToolName, Executable>>;

type Reply = { id?: unknown; status?: unknown; code?: unknown; message?: unknown };

/**
 * The toolkit returns PayPal's reply, or its error, as JSON text. A refund
 * comes back as COMPLETED or PENDING; a 4xx means PayPal said no and nothing
 * moved, so the amount is freed; anything else leaves the outcome unknown and
 * the refund stays PENDING until get_refund or the webhook settles it.
 */
export function readRefundReply(raw: unknown): { paypalRefundId: string; status: "COMPLETED" | "PENDING" } {
  let reply: Reply | undefined;
  try {
    reply = (typeof raw === "string" ? JSON.parse(raw) : raw) as Reply;
  } catch {
    throw new Error("PayPal's refund reply could not be read; the outcome is unknown");
  }
  if (typeof reply?.id === "string" && (reply.status === "COMPLETED" || reply.status === "PENDING")) {
    return { paypalRefundId: reply.id, status: reply.status };
  }
  if (typeof reply?.id === "string" && (reply.status === "FAILED" || reply.status === "CANCELLED")) {
    throw new RefundRejected(`PayPal reports the refund ${String(reply.status).toLowerCase()}`);
  }
  if (reply?.code === "PAYPAL_API_HTTP_ERROR" && typeof reply.status === "number" && reply.status >= 400 && reply.status < 500) {
    throw new RefundRejected(`PayPal refused the refund (${reply.status})${typeof reply.message === "string" ? `: ${reply.message}` : ""}`);
  }
  throw new Error(`the refund's outcome is unknown (${String(reply?.code ?? reply?.status ?? "no reply")})`);
}

export class ToolkitRefundGateway implements RefundGateway {
  /** `toolsFor` gives the tools for one refund, keyed on its PayPal-Request-Id. Replaceable in the eval. */
  constructor(private readonly toolsFor: (requestId: string) => RefundTools = (requestId) => paypalToolkitTools({ requestId })) {}

  async refund(input: Parameters<RefundGateway["refund"]>[0]) {
    const raw = await runAgentTool(this.toolsFor(input.idempotencyKey) as Record<string, Executable>, "create_refund", {
      capture_id: input.captureId,
      amount: paypalAmount(input.amountMinor, input.currency),
    });
    return readRefundReply(raw);
  }
}
