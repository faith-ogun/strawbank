import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { type BasketCount, countShelf } from "../src/lib/ai/count";
import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import { loadItems } from "./lib/truth";
import type { Eval } from "./lib/types";

const MEDIA_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const TARGET_EXACT_RATE = 0.9;

// E3. Shelf counting: per-item absolute error, morning and dusk. Every item on
// the list is scored on every photo (an item not on the shelf should be 0).
// When the model is unsure, the dusk report must say "uncertain", never
// "missing"; "unsureWhenWrong" is the share of wrong counts the model flagged.
// Like E1 it is provisional until all 20 photos are in.
export const e3: Eval = {
  id: "E3",
  title: "Shelf counting",
  target: "absolute error 0 on at least 90% of item counts (proposed)",
  async run(ctx) {
    const set = ctx.truth.shelves;
    const { items } = loadItems(ctx.root);
    if (set.entries.length === 0 || set.errors.length > 0 || !items || geminiNeeds().length > 0) {
      return notBuiltYet(this, [...photoNeeds(set, "shelf photos (10 days, morning and dusk)"), ...geminiNeeds()]);
    }
    const list = items.items.map(({ key, name, looks }) => ({ key, name, looks }));

    const cases: object[] = [];
    let itemCounts = 0;
    let exactCounts = 0;
    let wrongCounts = 0;
    let wrongButUnsure = 0;
    let totalError = 0;
    let errors = 0;
    for (const entry of set.entries) {
      const truth = entry.truth.counts as Record<string, number>;
      const started = Date.now();
      let reply: BasketCount | undefined;
      try {
        reply = await countShelf({
          photo: readFileSync(entry.photoPath),
          mediaType: MEDIA_TYPES[extname(entry.photoPath).toLowerCase()],
          items: list,
        });
      } catch (error) {
        errors++;
        itemCounts += list.length;
        cases.push({ id: entry.id, truth, error: String(error).slice(0, 500), ms: Date.now() - started });
        continue;
      }
      for (const { key } of list) {
        const error = Math.abs((reply.counts[key] ?? 0) - (truth[key] ?? 0));
        itemCounts++;
        totalError += error;
        if (error === 0) exactCounts++;
        else {
          wrongCounts++;
          if ((reply.confidence[key] ?? 0) < 0.8) wrongButUnsure++;
        }
      }
      cases.push({ id: entry.id, day: entry.truth.day, time: entry.truth.time, truth, reply, ms: Date.now() - started });
    }

    const exactRate = exactCounts / itemCounts;
    const metrics = {
      photos: set.entries.length,
      errors,
      itemCounts,
      exactCounts,
      exactRate,
      meanItemError: totalError / itemCounts,
      wrongCounts,
      unsureWhenWrong: wrongCounts === 0 ? 1 : wrongButUnsure / wrongCounts,
      expected: set.expected,
    };
    const judged = set.entries.length >= set.expected;
    const met = errors === 0 && exactRate >= TARGET_EXACT_RATE;
    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: !judged ? "skip" : met ? "pass" : "fail",
      ...(!judged && { reason: `provisional: ${set.entries.length} of ${set.expected} shelf photos; the target is judged once all are in` }),
      ...(judged && !met && { reason: errors > 0 ? `${errors} model call(s) failed` : "below target" }),
      metrics,
      cases,
    };
  },
};
