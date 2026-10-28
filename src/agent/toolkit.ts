// The PayPal Agent Toolkit set up for Strawbank (sandbox, the allowlisted
// actions only), and its tools in the shape AI SDK v7 expects. Toolkit 1.11.0
// builds its tools with AI SDK v4 (`parameters`); v7 wants `inputSchema`.
//
// Tools that move money are never handed to the model (hard rule 3): code runs
// create_refund itself, with the amount src/lib/refunds.ts decided. Eval E4.6c
// checks the model's tool set.

import { PayPalAgentToolkit } from "@paypal/agent-toolkit/ai-sdk";
import { type FlexibleSchema, type Tool, tool } from "ai";
import { paypalCredentials } from "../lib/paypal/config";
import { AGENT_TOOLS, type AgentToolName, TOOLKIT_ACTIONS, pickAgentTools, runAgentTool } from "./tools";

/** A toolkit tool as AI SDK v4 shapes it. Its execute never throws: errors come back as JSON text. */
export type ToolkitTool = {
  description?: string;
  parameters: unknown;
  execute?: (args: never, options?: never) => Promise<unknown>;
};

export type ToolkitTools = Partial<Record<AgentToolName, ToolkitTool>>;

/**
 * The allowlisted toolkit tools. Building them makes no network call. The
 * toolkit sends one PayPal-Request-Id for everything an instance does, so a
 * refund gets a toolkit of its own with that refund's `requestId`.
 */
export function paypalToolkitTools(
  options: { requestId?: string; credentials?: { clientId: string; clientSecret: string } } = {},
): ToolkitTools {
  const { clientId, clientSecret } = options.credentials ?? paypalCredentials();
  const toolkit = new PayPalAgentToolkit({
    clientId,
    clientSecret,
    configuration: {
      actions: TOOLKIT_ACTIONS,
      context: { sandbox: true, ...(options.requestId && { request_id: options.requestId }) },
    },
  });
  return pickAgentTools(toolkit.getTools() as unknown as Record<string, ToolkitTool>);
}

/** Tools that move money. Code runs them; the model never sees them. */
export const MONEY_TOOLS: readonly AgentToolName[] = ["create_refund"];

/** What the model may call: the allowlist minus the money tools. */
export const MODEL_TOOLS = AGENT_TOOLS.filter((name) => !MONEY_TOOLS.includes(name));

/** The model's tools as AI SDK v7 tools. Each call still goes through the allowlist check. */
export function modelTools(source: ToolkitTools): Record<string, Tool> {
  return Object.fromEntries(
    MODEL_TOOLS.flatMap((name) => {
      const t = source[name];
      if (!t) return [];
      const adapted = tool({
        description: t.description,
        inputSchema: t.parameters as FlexibleSchema<unknown>,
        execute: (input: unknown) => runAgentTool(source as Record<string, ToolkitTool>, name, input),
      });
      return [[name, adapted]];
    }),
  );
}
