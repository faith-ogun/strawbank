import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { type BasketCount, basketConfidence, countBasket, isSure } from "../src/lib/ai/count";
import { type CountCase, scoreCounts } from "./lib/counting";
import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import { loadItems } from "./lib/truth";
import type { Eval } from "./lib/types";

const MEDIA_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Gemini calls in flight at once. */
const PARALLEL = 4;

const TARGET_EXACT_RATE = 0.85;

// E1. Basket counting: exact-basket rate, per-item absolute error, and how
// many high-confidence baskets were exactly right. It runs on whatever basket
// photos exist; until all of them do, the numbers are provisional and the
// target is not judged.
export const e1: Eval = {
  id: "E1",
  title: "Basket counting",
  target: "at least 85% of baskets exact; no basket off by more than one item (proposed)",
  async run(ctx) {
    const set = ctx.truth.baskets;
    const { items } = loadItems(ctx.root);
    if (set.entries.length === 0 || set.errors.length > 0 || !items || geminiNeeds().length > 0) {
      return notBuiltYet(this, [...photoNeeds(set, "basket photos"), ...geminiNeeds()]);
    }

    const keys = items.items.map((i) => i.key);
    const cases: (CountCase & { reply?: BasketCount; confidence?: number; error?: string; ms: number })[] = [];
    const queue = [...set.entries];
    await Promise.all(
      Array.from({ length: PARALLEL }, async () => {
        for (let entry = queue.shift(); entry; entry = queue.shift()) {
          const truth = entry.truth.counts as Record<string, number>;
          const started = Date.now();
          try {
            const reply = await countBasket({
              photo: readFileSync(entry.photoPath),
              mediaType: MEDIA_TYPES[extname(entry.photoPath).toLowerCase()],
              items: items.items,
            });
            cases.push({
              id: entry.id,
              truth,
              counted: reply.counts,
              sure: isSure(reply),
              confidence: basketConfidence(reply),
              reply,
              ms: Date.now() - started,
            });
          } catch (error) {
            cases.push({ id: entry.id, truth, sure: false, error: String(error).slice(0, 500), ms: Date.now() - started });
          }
        }
      }),
    );
    cases.sort((a, b) => a.id.localeCompare(b.id));

    const score = scoreCounts(keys, cases);
    const metrics = { ...score, expected: set.expected };
    const judged = set.entries.length >= set.expected;
    const met = score.errors === 0 && score.exactRate >= TARGET_EXACT_RATE && score.worstError <= 1;

    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: !judged ? "skip" : met ? "pass" : "fail",
      ...(!judged && {
        reason: `provisional: ${set.entries.length} of ${set.expected} basket photos; the target is judged once all are in`,
      }),
      ...(judged && !met && { reason: score.errors > 0 ? `${score.errors} model call(s) failed` : "below target" }),
      metrics,
      cases,
    };
  },
};
