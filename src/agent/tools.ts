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
 * code of the tool runs, even if the tool was somehow passed in.
 */
export async function runAgentTool<T extends Executable>(
  tools: Record<string, T>,
  name: string,
  args: unknown,
): Promise<unknown> {
  if (!isAgentTool(name)) throw new ToolNotAllowed(`the agent may not call "${name}"`);
  const tool = pickAgentTools(tools)[name];
  if (!tool?.execute) throw new ToolNotAllowed(`"${name}" is not available`);
  return (tool.execute as (args: unknown) => unknown)(args);
}
