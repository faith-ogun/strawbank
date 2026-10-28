// Gemini through the Vercel AI SDK. The model reads, counts and explains; it
// never produces an amount of money (spec section 6).
//
// AI_PROVIDER=vertex (default) uses Vertex AI in the app's own GCP project
// with the Cloud Run service account, so there is no key to store.
// AI_PROVIDER=google uses a Gemini API key instead.

import { google } from "@ai-sdk/google";
import { googleVertex } from "@ai-sdk/google-vertex";

/**
 * "careful" (GEMINI_MODEL) for work that can wait, such as the recount behind a
 * refund; "fast" (GEMINI_FAST_MODEL) for a customer waiting at the stand.
 * Without GEMINI_FAST_MODEL, both use GEMINI_MODEL.
 */
export type ModelSpeed = "careful" | "fast";

export function geminiModel(speed: ModelSpeed = "careful") {
  const id = (speed === "fast" && process.env.GEMINI_FAST_MODEL) || process.env.GEMINI_MODEL;
  if (!id) throw new Error("GEMINI_MODEL must be set");
  return process.env.AI_PROVIDER === "google" ? google(id) : googleVertex(id);
}
