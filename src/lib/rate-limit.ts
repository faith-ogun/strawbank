// Per-visitor limits for the public demo, so it survives the judging weeks:
// each route that calls Gemini or makes PayPal do something allows a visitor a
// fair number of tries in a window, far above what a person trying the stand
// needs. Kept in the memory of each Cloud Run instance (at most two), so the
// limit is approximate, which is enough to stop a loop or a script.

const hits = new Map<string, number[]>();

/** True if `key` may go ahead: fewer than `limit` tries in the last `windowMs`. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) for (const [k, times] of hits) if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}

/** The visitor's address as Cloud Run's front end saw it (the first entry it adds). */
export function visitor(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const TEN_MINUTES = 10 * 60 * 1000;

/** The limits, per visitor, per route, in ten minutes. */
export const LIMITS = {
  count: 40,
  order: 30,
  iou: 6,
  refundClaim: 10,
  growerPhoto: 30,
  studioTurn: 300,
  buttonReport: 20,
} as const;

/** A 429 if this visitor has used up `route`'s limit; otherwise undefined. */
export function limited(request: Request, route: keyof typeof LIMITS): Response | undefined {
  if (allow(`${route}:${visitor(request)}`, LIMITS[route], TEN_MINUTES)) return undefined;
  return Response.json({ error: "that is a lot of tries in a few minutes; please wait a little and try again" }, { status: 429 });
}
