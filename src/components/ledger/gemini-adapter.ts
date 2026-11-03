// AG Studio's AgLlmAdapter, pointed at our own route (/api/studio/llm), which
// asks Gemini on Vertex. Studio runs every tool on the page; this only carries
// each turn there and back, and keeps Gemini's thought signatures beside the
// call ids, because Studio's conversation items have no field for them. No key
// is ever in the browser: the route uses the Cloud Run service's own identity.

import type { AgAiEvent, AgAiOutputItem, AgLlmAdapter, AgLlmResponse } from "ag-studio";
import type { StudioReply } from "@/lib/ai/studio-turn";

export function geminiAdapter(endpoint = "/api/studio/llm"): AgLlmAdapter {
  const signatures = new Map<string, string>();

  return {
    executeTurn(request, options) {
      const createdAt = Date.now();
      const asked = new Set(request.input.flatMap((item) => (item.type === "function_call" ? [item.callId] : [])));
      const complete: Promise<AgLlmResponse> = (async () => {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ request, signatures: Object.fromEntries([...signatures].filter(([id]) => asked.has(id))) }),
            signal: options?.signal,
          });
          const reply = (await response.json()) as StudioReply & { error?: string };
          if (!response.ok) throw new Error(reply.error ?? `the assistant's route answered ${response.status}`);
          for (const call of reply.toolCalls) if (call.signature) signatures.set(call.callId, call.signature);

          const output: AgAiOutputItem[] = [];
          if (reply.reasoning) output.push({ id: `${reply.id}-reasoning`, kind: "output", type: "reasoning", summary: [{ type: "summary", text: reply.reasoning }] });
          if (reply.text) {
            output.push({ id: `${reply.id}-text`, kind: "output", type: "message", role: "assistant", status: "completed", content: [{ type: "text", text: reply.text, annotations: [] }] });
          }
          for (const call of reply.toolCalls) {
            output.push({ id: call.callId, kind: "output", type: "function_call", callId: call.callId, name: call.name, arguments: call.arguments, status: "completed" });
          }
          return {
            id: reply.id,
            createdAt,
            output,
            status: reply.finish === "length" ? "incomplete" : "completed",
            ...(reply.finish === "length" && { incompleteDetails: { reason: "max_output_tokens" as const } }),
            usage: { inputTokens: reply.usage?.inputTokens ?? 0, outputTokens: reply.usage?.outputTokens ?? 0 },
            model: reply.model,
          };
        } catch (error) {
          return {
            id: `failed-${createdAt}`,
            createdAt,
            output: [],
            status: options?.signal?.aborted ? "cancelled" : "failed",
            error: { code: "gemini", message: error instanceof Error ? error.message : String(error) },
          };
        }
      })();

      // The whole turn arrives at once, so the events are replayed from the final output.
      const stream = {
        async *[Symbol.asyncIterator](): AsyncIterator<AgAiEvent> {
          for (const item of (await complete).output) {
            if (item.type === "reasoning") {
              yield { type: "REASONING_MESSAGE_START", messageId: item.id, role: "reasoning" };
              yield { type: "REASONING_MESSAGE_CONTENT", messageId: item.id, delta: item.summary.map((s) => s.text).join("\n") };
              yield { type: "REASONING_MESSAGE_END", messageId: item.id };
            } else if (item.type === "message") {
              yield { type: "TEXT_MESSAGE_START", messageId: item.id, role: "assistant" };
              for (const part of item.content) if (part.type === "text") yield { type: "TEXT_MESSAGE_CONTENT", messageId: item.id, delta: part.text };
              yield { type: "TEXT_MESSAGE_END", messageId: item.id };
            } else {
              yield { type: "TOOL_CALL_START", toolCallId: item.callId, toolCallName: item.name };
              yield { type: "TOOL_CALL_ARGS", toolCallId: item.callId, delta: item.arguments };
              yield { type: "TOOL_CALL_END", toolCallId: item.callId };
            }
          }
        },
      };
      return { stream, complete };
    },
  };
}
