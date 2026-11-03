// The agent's PayPal tools (spec section 5). Only these names are ever handed
// to the model, and every call is checked again when it runs (eval E4.6).
// Names are as the Agent Toolkit defines them; the spec's `list_product` is
// the toolkit's `list_products`.

export const AGENT_TOOLS = [
  "create_product",
  "list_products",
  "get_order",
  "create_refund",
  "get_refund",
  "list_transactions",
  "get_merchant_insights",
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number];

/** The toolkit's `configuration.actions` that switches on exactly AGENT_TOOLS. */
export const TOOLKIT_ACTIONS = {
  products: { create: true, list: true },
  orders: { get: true },
  payments: { createRefund: true, getRefunds: true },
  transactions: { list: true },
  insights: { get: true },
};

export class ToolNotAllowed extends Error {}

/** A toolkit call that gave no answer in time. PayPal may still act on it, so its outcome is unknown. */
export class ToolTimedOut extends Error {}

/**
 * Per call, in ms. The toolkit sends its requests with no timeout of its own,
 * so without this a call that hangs would hold its request until Cloud Run
 * ends it (eval E4.6d).
 */
export const TOOL_DEADLINE_MS = 20_000;

export function isAgentTool(name: string): name is AgentToolName {
  return (AGENT_TOOLS as readonly string[]).includes(name);
}

/** Keeps only the allowlisted tools, whatever the source offers. */
export function pickAgentTools<T>(tools: Record<string, T>): Partial<Record<AgentToolName, T>> {
  return Object.fromEntries(Object.entries(tools).filter(([name]) => isAgentTool(name)));
}

type Executable = { execute?: (args: never, options?: never) => unknown };

/**
 * Runs a tool call by name. Anything outside the allowlist throws before any
 * code of the tool runs, even if the tool was somehow passed in. A call with
 * no answer by the deadline throws ToolTimedOut; the request itself may still
 * reach PayPal, which is why a timed-out refund stays pending.
 */
export async function runAgentTool<T extends Executable>(
  tools: Record<string, T>,
  name: string,
  args: unknown,
  deadlineMs = TOOL_DEADLINE_MS,
): Promise<unknown> {
  if (!isAgentTool(name)) throw new ToolNotAllowed(`the agent may not call "${name}"`);
  const tool = pickAgentTools(tools)[name];
  if (!tool?.execute) throw new ToolNotAllowed(`"${name}" is not available`);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimedOut(`"${name}" gave no answer in ${deadlineMs} ms`)), deadlineMs);
  });
  try {
    return await Promise.race([Promise.resolve((tool.execute as (args: unknown) => unknown)(args)), late]);
  } finally {
    clearTimeout(timer);
  }
}
