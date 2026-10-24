// Truth files: one hand-written JSON file per photo, saying what is really in
// it. The format is described in docs/eval.md; this file is the checker.
//
//   eval/truth/items.json               the items the photos may show
//   eval/truth/<set>/<id>.json          the truth for one photo
//   eval/photos/<set>/<id>.jpg          the photo (.jpg, .jpeg, .png or .webp)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CURRENCIES } from "../../src/lib/money";
import { MAX_QUANTITY } from "../../src/lib/orders";

const itemKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "item keys are lower-case words joined by hyphens");
const counts = z.record(itemKey, z.number().int().min(0).max(MAX_QUANTITY));
const price = z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'prices are written like "3.50"');
const note = z.string().optional();

export const ItemsFile = z
  .object({
    currency: z.enum(CURRENCIES),
    items: z
      .array(z.object({ key: itemKey, name: z.string().min(1), looks: z.string().optional() }).strict())
      .min(1),
  })
  .strict();

export const BasketTruth = z
  .object({
    counts,
    unlisted: z.array(z.object({ what: z.string().min(1), count: z.number().int().min(1) }).strict()).optional(),
    tags: z.array(z.string()).optional(),
    note,
  })
  .strict();

export const ShelfTruth = z
  .object({
    day: z.string().regex(/^day-\d{2}$/, 'days are named like "day-03"'),
    time: z.enum(["morning", "dusk"]),
    counts,
    note,
  })
  .strict();

export const PriceCardTruth = z
  .object({
    currency: z.enum(CURRENCIES),
    lines: z.array(z.object({ text: z.string().min(1), item: itemKey, price }).strict()).min(1),
    note,
  })
  .strict();

export const TRAPS = ["instruction-on-card", "blurred", "unlisted-item", "empty-basket", "duplicate", "face"] as const;

export const TrapTruth = z
  .object({
    trap: z.enum(TRAPS),
    /** For "duplicate": the other photo, as "<set>/<id>". */
    duplicateOf: z.string().regex(/^[a-z-]+\/[\w-]+$/).optional(),
    /** What a correct count would be, where one exists. */
    counts: counts.optional(),
    note,
  })
  .strict()
  .refine((t) => t.trap !== "duplicate" || t.duplicateOf, { message: '"duplicate" needs "duplicateOf"' });

export const SETS = {
  baskets: { schema: BasketTruth, expected: 40 },
  shelves: { schema: ShelfTruth, expected: 20 },
  "price-cards": { schema: PriceCardTruth, expected: 10 },
  traps: { schema: TrapTruth, expected: 6 },
} as const;

export type SetName = keyof typeof SETS;

const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type TruthEntry = { id: string; truthPath: string; photoPath: string; truth: Record<string, unknown> };

export type TruthSet = {
  set: SetName;
  expected: number;
  entries: TruthEntry[];
  /** Photos with no truth file. */
  photosWithoutTruth: string[];
  errors: string[];
};

function listFiles(dir: string, extensions: string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => extensions.some((ext) => f.toLowerCase().endsWith(ext)));
}

const stem = (file: string) => file.replace(/\.[^.]+$/, "");

export function loadItems(root: string): { items?: z.infer<typeof ItemsFile>; errors: string[] } {
  const path = join(root, "eval/truth/items.json");
  if (!existsSync(path)) return { errors: [] };
  try {
    const parsed = ItemsFile.safeParse(JSON.parse(readFileSync(path, "utf8")));
    if (!parsed.success) return { errors: parsed.error.issues.map((i) => `items.json: ${i.path.join(".")} ${i.message}`) };
    const keys = parsed.data.items.map((i) => i.key);
    const repeated = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (repeated.length > 0) return { errors: [`items.json: listed twice: ${repeated.join(", ")}`] };
    return { items: parsed.data, errors: [] };
  } catch (error) {
    return { errors: [`items.json: ${(error as Error).message}`] };
  }
}

export function loadTruthSet(root: string, set: SetName, itemKeys: Set<string> | undefined): TruthSet {
  const truthDir = join(root, "eval/truth", set);
  const photoDir = join(root, "eval/photos", set);
  const photos = listFiles(photoDir, PHOTO_EXTENSIONS);
  const truths = listFiles(truthDir, [".json"]);
  const errors: string[] = [];
  const entries: TruthEntry[] = [];

  for (const file of truths) {
    const id = stem(file);
    const where = `${set}/${file}`;
    const photo = photos.find((p) => stem(p) === id);
    if (!photo) errors.push(`${where}: no photo eval/photos/${set}/${id}.jpg`);
    let truth: Record<string, unknown>;
    try {
      const parsed = SETS[set].schema.safeParse(JSON.parse(readFileSync(join(truthDir, file), "utf8")));
      if (!parsed.success) {
        for (const issue of parsed.error.issues) errors.push(`${where}: ${issue.path.join(".") || "file"} ${issue.message}`);
        continue;
      }
      truth = parsed.data as Record<string, unknown>;
    } catch (error) {
      errors.push(`${where}: ${(error as Error).message}`);
      continue;
    }
    const used = [
      ...Object.keys((truth.counts as Record<string, number> | undefined) ?? {}),
      ...((truth.lines as { item: string }[] | undefined) ?? []).map((l) => l.item),
    ];
    if (used.length > 0 && !itemKeys) errors.push(`${where}: eval/truth/items.json is missing`);
    for (const key of used) if (itemKeys && !itemKeys.has(key)) errors.push(`${where}: "${key}" is not in items.json`);
    const other = truth.duplicateOf as string | undefined;
    if (other && !PHOTO_EXTENSIONS.some((ext) => existsSync(join(root, "eval/photos", other + ext)))) {
      errors.push(`${where}: duplicateOf "${other}" has no photo`);
    }
    if (photo) entries.push({ id, truthPath: join(truthDir, file), photoPath: join(photoDir, photo), truth });
  }

  const photosWithoutTruth = photos.filter((p) => !truths.some((t) => stem(t) === stem(p))).map((p) => `${set}/${p}`);
  return { set, expected: SETS[set].expected, entries, photosWithoutTruth, errors };
}
