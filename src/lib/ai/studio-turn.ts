// One turn of AG Studio's agents, answered by Gemini on Vertex. The ledger's
// agents run in the grower's browser (AG Studio's Direct LLM Runner); each
// turn, the browser posts Studio's request here, Gemini answers with text or
// tool calls, and Studio runs the tools on the page. The model never runs a
// tool here and never sees PayPal.
//
// Hard rule 3 holds for the agents' prose too: any number in Gemini's text
// must already appear in the data the tools returned this conversation (rows
// code produced) or in the grower's own words; otherwise the text is replaced
// by a code-written line pointing at the page.
//
// Gemini 3 signs each function call (a "thought signature") and wants it back
// with the call next turn. Studio's conversation items have no field for it,
// so the browser keeps it beside the call id and sends it back in
// `signatures`. Calls Studio itself seeds before a helper agent's first turn
// (view_widget, view_plan) never came from Gemini and have no signature; for
// those the AI SDK sends Google's documented placeholder.

import { type ModelMessage, Output, generateText, jsonSchema, tool } from "ai";
import { readNumbers } from "../explain-check";
import { hedged } from "./hedged";
import { geminiModel } from "./model";

/** The parts of AG Studio's AgLlmRequest this route reads (ag-studio's own type, kept loose for the wire). */
export type StudioRequest = {
  input: StudioItem[];
  instructions?: string;
  tools?: { name: string; description?: string; parameters?: unknown; kind?: string }[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  responseFormat?: { type: "text" } | { type: "json"; name: string; description?: string; schema: unknown };
};

type StudioItem =
  | { type: "message"; role: "user" | "system" | "assistant"; content: { type: string; text?: string; refusal?: string }[] }
  | { type: "function_call"; callId: string; name: string; arguments: string }
  | { type: "function_call_output"; callId: string; output: string }
  | { type: "reasoning" };

export type StudioReply = {
  id: string;
  text?: string;
  /** "model": Gemini's words, every number checked; "replaced": code's line instead. */
  textBy?: "model" | "replaced";
  reasoning?: string;
  toolCalls: { callId: string; name: string; arguments: string; signature?: string }[];
  usage?: { inputTokens?: number; outputTokens?: number };
  model: string;
  finish: string;
};

export const REPLACED_TEXT = "Done. The answer is on the page, in widgets whose numbers come straight from the ledger.";

const textOf = (item: Extract<StudioItem, { type: "message" }>) =>
  item.content.map((c) => c.text ?? c.refusal ?? "").join("\n");

const signed = (signature: string | undefined) =>
  signature ? { google: { thoughtSignature: signature }, googleVertex: { thoughtSignature: signature }, vertex: { thoughtSignature: signature } } : undefined;

/**
 * Studio's conversation as AI SDK messages, with each call's signature put back.
 * Gemini signs only the first call of a parallel batch, and Studio lists each
 * call next to its result, so an unsigned call joins the model turn of the
 * signed call before it, and its result joins that turn's results: Gemini
 * wants all of a turn's calls before any of their results.
 */
export function toMessages(input: StudioItem[], signatures: Record<string, string>): ModelMessage[] {
  type Assistant = Extract<ModelMessage, { role: "assistant" }> & { content: Exclude<Extract<ModelMessage, { role: "assistant" }>["content"], string> };
  type Tool = Extract<ModelMessage, { role: "tool" }>;
  const names = new Map<string, string>();
  const messages: ModelMessage[] = [];
  let calls: Assistant | undefined;
  let results: Tool | undefined;
  for (const item of input) {
    if (item.type === "message") {
      const text = textOf(item);
      if (!text) continue;
      messages.push(item.role === "assistant" ? { role: "assistant", content: [{ type: "text", text }] } : { role: "user", content: text });
      calls = results = undefined;
    } else if (item.type === "function_call") {
      names.set(item.callId, item.name);
      let args: unknown = {};
      try {
        args = item.arguments ? JSON.parse(item.arguments) : {};
      } catch {
        args = {};
      }
      const signature = signatures[item.callId];
      const part = { type: "tool-call" as const, toolCallId: item.callId, toolName: item.name, input: args, providerOptions: signed(signature) };
      if (calls && !signature) calls.content.push(part);
      else {
        calls = { role: "assistant", content: [part] };
        messages.push(calls);
        results = undefined;
      }
    } else if (item.type === "function_call_output") {
      const part = { type: "tool-result" as const, toolCallId: item.callId, toolName: names.get(item.callId) ?? "tool", output: { type: "text" as const, value: item.output } };
      if (results) results.content.push(part);
      else {
        results = { role: "tool", content: [part] };
        messages.push(results);
      }
    }
  }
  return messages;
}

/** Every number the model may repeat: those in tool results (code's rows) and in the grower's own messages. */
export function allowedFromConversation(input: StudioItem[]): number[] {
  const values: number[] = [];
  for (const item of input) {
    if (item.type === "function_call_output") values.push(...readNumbers(item.output).values);
    if (item.type === "message" && item.role === "user") values.push(...readNumbers(textOf(item)).values);
  }
  return values;
}

/** The model's text if every number in it is one it was given; otherwise code's line. */
export function checkedText(text: string, allowed: number[]): { text: string; by: "model" | "replaced" } {
  const reading = readNumbers(text);
  const permitted = new Set(allowed.map((n) => String(Math.abs(n))));
  const ok = reading.uncheckable.length === 0 && reading.values.every((n) => permitted.has(String(Math.abs(n))));
  return ok ? { text, by: "model" } : { text: REPLACED_TEXT, by: "replaced" };
}

export async function runStudioTurn(request: StudioRequest, signatures: Record<string, string>, signal?: AbortSignal): Promise<StudioReply> {
  const tools = Object.fromEntries(
    (request.tools ?? [])
      .filter((t) => t.kind === undefined || t.kind === "client")
      .map((t) => [t.name, tool({ description: t.description ?? "", inputSchema: jsonSchema((t.parameters ?? { type: "object" }) as never) })]),
  );
  const choice = request.toolChoice;
  const toolChoice = typeof choice === "object" ? { type: "tool" as const, toolName: choice.name } : choice;
  const format = request.responseFormat;
  // A turn normally answers in 2 to 25 s; a second try at 20 s covers a stalled call.
  const ask = (abortSignal: AbortSignal) =>
    generateText({
      model: geminiModel("careful"),
      instructions: request.instructions,
      messages: toMessages(request.input, signatures),
      ...(Object.keys(tools).length > 0 && { tools, toolChoice }),
      ...(format?.type === "json" && { output: Output.object({ schema: jsonSchema(format.schema as never), name: format.name, description: format.description }) }),
      providerOptions: { vertex: { thinkingConfig: { thinkingLevel: "low" } }, google: { thinkingConfig: { thinkingLevel: "low" } } },
      maxOutputTokens: 8192,
      maxRetries: 0,
      timeout: { totalMs: 45_000 },
      abortSignal: signal ? AbortSignal.any([signal, abortSignal]) : abortSignal,
    });
  const result = await hedged(ask, [0, 20_000]);

  const toolCalls = result.toolCalls.map((call) => {
    const meta = (call as { providerMetadata?: Record<string, { thoughtSignature?: unknown }> }).providerMetadata;
    const signature = meta?.googleVertex?.thoughtSignature ?? meta?.vertex?.thoughtSignature ?? meta?.google?.thoughtSignature;
    return { callId: call.toolCallId, name: call.toolName, arguments: JSON.stringify(call.input ?? {}), signature: typeof signature === "string" ? signature : undefined };
  });
  const raw = result.text.trim();
  // JSON output is structure for Studio (a plan, say), not prose for the grower.
  const shown = raw && format?.type !== "json" ? checkedText(raw, allowedFromConversation(request.input)) : undefined;
  return {
    id: result.response.id ?? crypto.randomUUID(),
    text: shown ? shown.text : raw || undefined,
    textBy: shown?.by,
    reasoning: result.reasoningText?.trim() || undefined,
    toolCalls,
    usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
    model: result.response.modelId,
    finish: result.finishReason,
  };
}
