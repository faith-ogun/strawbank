// The second face check (decided 4 Nov): Google Cloud Vision's face detection
// runs at the same moment as Gemini's count, so it adds no wait, and a photo is
// refused if either one finds a face (eval E6). Vision detects faces; it does
// not recognise who anyone is. A photo sent this way is processed in memory and
// not stored, and Google does not train on it (Vision's data-usage page, read
// 4 Nov 2026).

import { GoogleAuth } from "google-auth-library";
import type { BasketCount } from "./count";

/** Vision's confidence that what it found is a face, at or above which the photo is refused. */
export const VISION_FACE_CONFIDENCE = 0.5;

/**
 * Vision usually answers well inside Gemini's count. If it has not answered by
 * then, or fails, Gemini's check alone decides: the customer is never kept
 * waiting on the second check.
 */
export const VISION_DEADLINE_MS = 5_000;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

export type VisionFaces = {
  face: boolean;
  /** Vision's confidence for each face it found, highest first. */
  confidence: number[];
  ms: number;
};

type AnnotateReply = {
  responses?: { faceAnnotations?: { detectionConfidence?: number }[]; error?: { message?: string } }[];
};

async function annotate(photo: Uint8Array, project: string, signal: AbortSignal): Promise<number[]> {
  const token = await auth.getAccessToken();
  // The project is named in the path and the header, so the call is billed to
  // Strawbank's project whatever the machine's default project is.
  const response = await fetch(`https://vision.googleapis.com/v1/projects/${project}/images:annotate`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-goog-user-project": project },
    body: JSON.stringify({
      requests: [{ image: { content: Buffer.from(photo).toString("base64") }, features: [{ type: "FACE_DETECTION", maxResults: 10 }] }],
    }),
    signal,
  });
  if (!response.ok) throw new Error(`Vision answered ${response.status}`);
  const reply = (await response.json()) as AnnotateReply;
  const first = reply.responses?.[0];
  if (!first) throw new Error("Vision sent no response for the photo");
  if (first.error) throw new Error(`Vision: ${first.error.message ?? "an error with no message"}`);
  return (first.faceAnnotations ?? []).map((f) => f.detectionConfidence ?? 0).sort((a, b) => b - a);
}

/** What Vision finds, or undefined if it gave no answer by the deadline or failed. Never throws. */
export async function visionFaces(photo: Uint8Array, deadlineMs = VISION_DEADLINE_MS): Promise<VisionFaces | undefined> {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) return undefined;
  const started = Date.now();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The token request is not covered by the fetch's signal, so the whole call races the deadline.
  const late = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(undefined);
    }, deadlineMs);
  });
  const found = annotate(photo, project, controller.signal).then(
    (confidence): VisionFaces => ({ face: confidence.some((c) => c >= VISION_FACE_CONFIDENCE), confidence, ms: Date.now() - started }),
    (error) => {
      if (!controller.signal.aborted) console.error("Vision face check failed:", error instanceof Error ? error.message : error);
      return undefined;
    },
  );
  try {
    const answer = await Promise.race([found, late]);
    if (!answer) console.warn(`Vision face check gave no answer within ${deadlineMs} ms; Gemini's check alone decides`);
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

/** Refused if Gemini or Vision finds a face. */
export function refusedForFace(count: Pick<BasketCount, "face">, vision: VisionFaces | undefined): boolean {
  return count.face || vision?.face === true;
}

/**
 * Starts Vision's face check alongside a count already under way, and marks
 * the count as having a face if either check found one.
 */
export async function withFaceCheck(photo: Uint8Array, counting: Promise<BasketCount>): Promise<BasketCount> {
  const [count, vision] = await Promise.all([counting, visionFaces(photo)]);
  const face = refusedForFace(count, vision);
  if (face) console.info(`photo refused for a face (Gemini: ${count.face}, Vision: ${vision?.face ?? "no answer"})`);
  return { ...count, face };
}
