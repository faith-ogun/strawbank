import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { type CardReading, readPriceCard } from "../src/lib/ai/price-card";
import { geminiNeeds, notBuiltYet, photoNeeds } from "./lib/needs";
import { loadItems } from "./lib/truth";
import type { Eval } from "./lib/types";

const MEDIA_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** A line the model is sure of; below this the grower is asked to check it. */
const SURE = 0.8;

type TruthLine = { text: string; item: string; price: string };

// E2. Price card reading: items and prices read exactly, per card. Like E1 it
// runs on whatever card photos exist; the target is judged once all 10 are in.
// "Exact" means every line on the card read with the right item and price, and
// no priced line that is not on the card. A wrong line the model was unsure of
// is caught by the grower's confirmation; a wrong line it was sure of is not.
export const e2: Eval = {
  id: "E2",
  title: "Price card reading",
  target: "10 of 10 counting the grower's confirmation; at least 8 of 10 with no correction (proposed)",
  async run(ctx) {
    const set = ctx.truth["price-cards"];
    const { items } = loadItems(ctx.root);
    if (set.entries.length === 0 || set.errors.length > 0 || !items || geminiNeeds().length > 0) {
      return notBuiltYet(this, [...photoNeeds(set, "price card photos"), ...geminiNeeds()]);
    }
    const known = items.items.map(({ key, name }) => ({ key, name }));

    const cases: object[] = [];
    let exact = 0;
    let caughtByGrower = 0;
    let errors = 0;
    let linesRight = 0;
    let linesTotal = 0;
    for (const entry of set.entries) {
      const truth = (entry.truth.lines as TruthLine[]).map((l) => ({ item: l.item, price: l.price }));
      const started = Date.now();
      let reading: CardReading | undefined;
      try {
        reading = await readPriceCard({
          photo: readFileSync(entry.photoPath),
          mediaType: MEDIA_TYPES[extname(entry.photoPath).toLowerCase()],
          known,
        });
      } catch (error) {
        errors++;
        cases.push({ id: entry.id, truth, error: String(error).slice(0, 500), ms: Date.now() - started });
        continue;
      }
      const read = new Map(reading.lines.map((l) => [l.key, l]));
      const right = truth.filter((t) => read.get(t.item)?.price === t.price);
      const extra = reading.lines.filter((l) => !truth.some((t) => t.item === l.key));
      const wrong = reading.lines.filter((l) => truth.some((t) => t.item === l.key && t.price !== l.price));
      const isExact = right.length === truth.length && extra.length === 0;
      // Not exact, but every mistake was flagged as unsure, so the grower checks it.
      const missing = truth.length - right.length - wrong.length;
      const flagged = !isExact && missing === 0 && [...wrong, ...extra].every((l) => l.confidence < SURE);
      linesTotal += truth.length;
      linesRight += right.length;
      if (isExact) exact++;
      if (isExact || flagged) caughtByGrower++;
      cases.push({ id: entry.id, truth, reading, exact: isExact, caughtByGrower: isExact || flagged, ms: Date.now() - started });
    }

    const n = set.entries.length;
    const metrics = { cards: n, errors, exact, exactRate: exact / n, caughtByGrower, linesRight, linesTotal, expected: set.expected };
    const judged = n >= set.expected;
    const met = errors === 0 && caughtByGrower === n && exact >= Math.ceil(0.8 * n);
    return {
      id: this.id,
      title: this.title,
      target: this.target,
      status: !judged ? "skip" : met ? "pass" : "fail",
      ...(!judged && { reason: `provisional: ${n} of ${set.expected} price card photos; the target is judged once all are in` }),
      ...(judged && !met && { reason: errors > 0 ? `${errors} model call(s) failed` : "below target" }),
      metrics,
      cases,
    };
  },
};
