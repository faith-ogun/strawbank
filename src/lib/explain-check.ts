// The model writes the dusk and audit explanations, but only from numbers code
// computed. Before any explanation is shown, every number in it is checked
// against those numbers; if one is new, the code-written template is shown
// instead (eval E4.5). The check errs on the side of rejecting: a rejected
// explanation costs some wording, a wrong number costs the grower's trust.
//
// Read as numbers: digits (12, 3.50, 1,234.00, 3rd, 85%, 1/2), number words
// and ordinals up to ninety-nine (twelve, twenty-one, third), superscript,
// circled and fraction characters (², ③, ½), and any digit in another script.
// Signs are ignored, so -2 is read as 2. Words that scale or
// split a number (dozen, hundred, half, twice, two-thirds) cannot be checked
// and always reject. Catalogue item names are removed first, so "Half-dozen
// eggs" or "Eggs (6)" never count.

import { CURRENCIES } from "./money";

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30,
  fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90,
};
const UNCHECKABLE = new Set([
  "hundred", "hundreds", "thousand", "thousands", "million", "millions", "billion", "billions",
  "dozen", "dozens", "score", "half", "halves", "quarter", "quarters", "double", "triple",
  "twice", "thrice", "pair", "pairs", "couple",
]);

function wordValue(word: string): number | undefined {
  return UNITS[word] ?? TENS[word] ?? ORDINALS[word];
}

function isFractionWord(word: string): boolean {
  // thirds, fifths, sixteenths ...: plural ordinals are fractions.
  return word.endsWith("s") && ORDINALS[word.slice(0, -1)] !== undefined;
}

export type NumberReading = { values: number[]; uncheckable: string[] };

/** Every number a reader could take from `text`, read as widely as possible. */
export function readNumbers(text: string): NumberReading {
  const values: number[] = [];
  const uncheckable: string[] = [];
  const normal = text.normalize("NFKC");

  for (const digit of normal.match(/\p{Nd}/gu) ?? []) {
    if (digit < "0" || digit > "9") uncheckable.push(digit);
  }

  // Groups of three after a comma, apostrophe or space can be thousands separators.
  for (const match of normal.matchAll(/\d+(?:[,' ]\d{3})*(?:\.\d+)?|\.\d+/g)) {
    const raw = match[0];
    const joined = raw.replace(/[,' ]/g, "");
    values.push(Number(joined));
    if (raw.includes(" ")) for (const part of raw.split(" ")) values.push(Number(part));
    const fraction = /^(\d+)\.(\d{3})$/.exec(joined);
    if (fraction) values.push(Number(fraction[1] + fraction[2])); // 1.000 can mean 1000
  }

  // 1/2, and ½ after NFKC (1⁄2), also read as their value.
  for (const [, top, bottom] of normal.matchAll(/(\d+)\s*[/⁄]\s*(\d+)/g)) {
    if (Number(bottom) !== 0) values.push(Number(top) / Number(bottom));
  }

  const lower = normal.toLowerCase();
  const words = [...lower.matchAll(/[a-z]+(?:-[a-z]+)*/g)];
  words.forEach((match, i) => {
    const parts = match[0].split("-");
    for (const part of parts) {
      if (UNCHECKABLE.has(part) || isFractionWord(part)) uncheckable.push(part);
    }
    const [tens, unit] = parts;
    if (parts.length === 2 && TENS[tens] !== undefined && (UNITS[unit] ?? ORDINALS[unit] ?? 10) < 10) {
      values.push(TENS[tens] + (UNITS[unit] ?? ORDINALS[unit]));
      return;
    }
    for (const part of parts) {
      const value = wordValue(part);
      if (value !== undefined) values.push(value);
    }
    // "twenty one" reads as 21 as well as 20 and 1.
    const next = words[i + 1];
    const between = next ? lower.slice(match.index + match[0].length, next.index) : "";
    if (parts.length === 1 && TENS[tens] !== undefined && next && /^\s+$/.test(between)) {
      const nextValue = UNITS[next[0]] ?? ORDINALS[next[0]];
      if (nextValue !== undefined && nextValue < 10) values.push(TENS[tens] + nextValue);
    }
  });

  return { values, uncheckable };
}

export type NumberCheck = {
  ok: boolean;
  notAllowed: number[];
  uncheckable: string[];
};

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withoutNames(text: string, names: string[]): string {
  return names
    .filter((name) => /\p{L}/u.test(name))
    .sort((a, b) => b.length - a.length)
    .reduce((rest, name) => rest.replace(new RegExp(escapeForRegExp(name), "giu"), " "), text);
}

const key = (n: number) => String(Math.abs(n));

/** Checks that every number in `text` is one of `allowed`. */
export function checkNumbers(text: string, allowed: number[], itemNames: string[] = []): NumberCheck {
  const permitted = new Set(allowed.map(key));
  const reading = readNumbers(withoutNames(text, itemNames));
  const notAllowed = [...new Set(reading.values.map(key))].filter((n) => !permitted.has(n)).map(Number);
  return { ok: notAllowed.length === 0 && reading.uncheckable.length === 0, notAllowed, uncheckable: reading.uncheckable };
}

/** The model's text if it passes the check, otherwise the code-written template. */
export function explanationToShow(
  modelText: string | undefined,
  allowed: number[],
  itemNames: string[],
  template: string,
): { text: string; source: "model" | "template"; check?: NumberCheck } {
  if (modelText === undefined) return { text: template, source: "template" };
  const check = checkNumbers(modelText, allowed, itemNames);
  return check.ok ? { text: modelText, source: "model", check } : { text: template, source: "template", check };
}

// Short text the model writes for a customer (a note on one count, an item not
// on the list) has no computed numbers to check against, so it must not touch
// money at all: a currency sign or code, or a word about prices or paying, and
// it is not shown. Like the check above, it errs on the side of rejecting.
const MONEY_WORDS =
  /\b(?:euros?|cents?|pence|penny|pennies|pounds?|quid|dollars?|bucks?|prices?|priced|costs?|costing|pay|pays|paying|paid|payment|charged?|charges?|refund(?:s|ed)?|totals?|free|cheap|discount(?:s|ed)?|worth|owe[sd]?)\b/i;

/** True when `text` says anything about money. */
export function mentionsMoney(text: string): boolean {
  const normal = text.normalize("NFKC");
  return /\p{Sc}/u.test(normal) || new RegExp(`\\b(?:${CURRENCIES.join("|")})\\b`, "i").test(normal) || MONEY_WORDS.test(normal);
}
