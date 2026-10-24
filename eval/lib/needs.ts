// What each eval needs before it can run. A skip always says exactly what is
// missing, so a skip never hides a result.

import type { EvalResult } from "./types";
import type { TruthSet } from "./truth";

export function geminiNeeds(): string[] {
  if (!process.env.GEMINI_MODEL) return ["the Gemini route: GEMINI_MODEL and its credentials in .env.local"];
  if (process.env.AI_PROVIDER === "google") {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY ? [] : ["GOOGLE_GENERATIVE_AI_API_KEY in .env.local"];
  }
  return process.env.GOOGLE_VERTEX_PROJECT ? [] : ["GOOGLE_VERTEX_PROJECT in .env.local"];
}

export function sandboxNeeds(): string[] {
  return process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
    ? []
    : ["PayPal sandbox app credentials: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local"];
}

export function photoNeeds(truth: TruthSet, label: string): string[] {
  const needs: string[] = [];
  if (truth.entries.length < truth.expected) {
    needs.push(
      `${truth.expected} ${label} with truth files in eval/photos/${truth.set}/ and eval/truth/${truth.set}/ (found ${truth.entries.length})`,
    );
  }
  if (truth.errors.length > 0) needs.push(`fix ${truth.errors.length} truth-file problem(s) listed above`);
  return needs;
}

/** A stub result: skipped, with what is missing, or "not built yet" if nothing is. */
export function notBuiltYet(base: Pick<EvalResult, "id" | "title" | "target">, needs: string[]): EvalResult {
  return {
    ...base,
    status: "skip",
    reason: needs.length > 0 ? "needs inputs that do not exist yet" : "inputs are ready; this eval is not built yet",
    needs,
  };
}
