import fc from "fast-check";
import { checkNumbers, explanationToShow } from "../../src/lib/explain-check";
import { type Currency, formatMoney } from "../../src/lib/money";
import { allowedNumbers, reconcileDay, templateExplanation } from "../../src/lib/reconcile";
import { assert, currencyArb, moneyProperty } from "./shared";

// Written separately from src/lib/explain-check.ts, so the two can catch each other out.
const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven",
  "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ORD_UNITS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth"];
const ORD_TENS = ["", "", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth", "seventieth", "eightieth", "ninetieth"];

function inWords(n: number): string {
  if (n < 20) return UNITS[n];
  const [t, u] = [Math.floor(n / 10), n % 10];
  return u === 0 ? TENS[t] : `${TENS[t]}-${UNITS[u]}`;
}

function ordinalWords(n: number): string {
  if (n < 20) return ORD_UNITS[n];
  const [t, u] = [Math.floor(n / 10), n % 10];
  return u === 0 ? ORD_TENS[t] : `${TENS[t]}-${ORD_UNITS[u]}`;
}

function ordinalDigits(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The ways a reader would recognise `n` as a number in an English sentence. */
function renderings(n: number, currency: Currency): string[] {
  const out = [n.toFixed(2), formatMoney(Math.round(n * 100), currency)];
  if (!Number.isInteger(n)) return [...out, String(n)];
  out.push(String(n), n.toLocaleString("en-IE"), `${n}%`);
  if (n >= 1) out.push(ordinalDigits(n));
  if (n <= 99) out.push(inWords(n));
  if (n >= 1 && n <= 99) out.push(ordinalWords(n));
  return out;
}

/** Ambiguous ways to write `n`, which a careless or misled model might use. */
function trickyRenderings(n: number): string[] {
  const wide = String(n).replace(/\d/g, (d) => String.fromCharCode(0xff10 + Number(d)));
  const out = [wide, `-${n}`];
  if (Number.isInteger(n) && n >= 1000) {
    const [high, low] = [Math.floor(n / 1000), String(n % 1000).padStart(3, "0")];
    out.push(`${high} ${low}`, `${high}.${low}`, `${high}'${low}`);
  }
  if (Number.isInteger(n) && n >= 21 && n <= 99 && n % 10 !== 0) out.push(`${TENS[Math.floor(n / 10)]} ${UNITS[n % 10]}`);
  for (const zero of [0x0660, 0x0966]) {
    out.push(String(n).replace(/\d/g, (d) => String.fromCharCode(zero + Number(d)))); // Arabic-Indic, Devanagari
  }
  if (Number.isInteger(n) && n <= 9) out.push("⁰¹²³⁴⁵⁶⁷⁸⁹"[n]);
  if (Number.isInteger(n) && n >= 1 && n <= 9) out.push(String.fromCharCode(0x2460 + n - 1)); // ① to ⑨
  const vulgar: Record<string, string[]> = { "0.5": ["½", "1/2"], "0.25": ["¼", "1/4"], "0.75": ["¾", "3/4"] };
  out.push(...(vulgar[String(n)] ?? []));
  return out;
}

/**
 * Numbers code did compute, written so they read as one it did not: "1.500"
 * for 1500 when 1.5 is allowed, "twenty one" for 21 when 20 and 1 are,
 * "2 100" for 2 and 100 when only 2100 is, "1/3" when 1 and 3 are. Whatever
 * the simple reading is, it is made allowed, so only the careful reading
 * catches the new number.
 */
const pad3 = (n: number) => String(n).padStart(3, "0");
const VULGAR: Record<string, string> = { "1/2": "½", "1/3": "⅓", "2/3": "⅔", "1/4": "¼", "3/4": "¾" };

const compositeArb = fc.oneof(
  fc
    .record({ high: fc.integer({ min: 1, max: 999 }), low: fc.integer({ min: 0, max: 999 }), sep: fc.constantFrom(" ", ",", "'") })
    .map(({ high, low, sep }) => ({ n: high * 1000 + low, allow: [high, low], text: `${high}${sep}${pad3(low)}` })),
  fc
    .record({ high: fc.integer({ min: 1, max: 999 }), low: fc.integer({ min: 0, max: 999 }) })
    .map(({ high, low }) => ({ n: high * 1000 + low, allow: [Number(`${high}.${pad3(low)}`)], text: `${high}.${pad3(low)}` })),
  fc
    .record({ t: fc.integer({ min: 2, max: 9 }), u: fc.integer({ min: 1, max: 9 }) })
    .map(({ t, u }) => ({ n: t * 10 + u, allow: [t * 10, u], text: `${TENS[t]} ${UNITS[u]}` })),
  fc
    .record({ high: fc.integer({ min: 1, max: 999 }), low: fc.integer({ min: 100, max: 999 }) })
    .map(({ high, low }) => ({ n: high, allow: [high * 1000 + low], text: `${high} ${low}` })),
  fc
    .record({ top: fc.integer({ min: 1, max: 8 }), bottom: fc.integer({ min: 2, max: 9 }), vulgar: fc.boolean() })
    .filter(({ top, bottom }) => top < bottom)
    .map(({ top, bottom, vulgar }) => ({
      n: top / bottom,
      allow: [top, bottom],
      text: (vulgar && VULGAR[`${top}/${bottom}`]) || `${top}/${bottom}`,
    })),
  // Words that scale or split a number cannot be checked at all.
  fc
    .constantFrom("twice", "a dozen", "half", "a hundred", "a thousand", "a quarter", "double", "a couple", "two-thirds")
    .map((text) => ({ n: Number.NaN, allow: [], text })),
);

const FILLER = ["jars", "taken", "paid", "for", "today", "at", "the", "stand", "missing", "Saturday", "running", "worth",
  "price", "left", "sold", "and", "of", "were", "unaccounted", "evening"];

const NAMES = ["Jam", "Free-range eggs (6)", "Half-dozen eggs", "Honey", "Rhubarb", "Sweet pea bunch", "Plums (1kg bag)",
  "Apple juice 75cl"];

const dayArb = fc.record({
  currency: currencyArb,
  items: fc.uniqueArray(
    fc.record({
      name: fc.constantFrom(...NAMES),
      unitMinor: fc.oneof(fc.integer({ min: 50, max: 2_000 }), fc.integer({ min: 1, max: 200_000 })),
      morning: fc.integer({ min: 0, max: 40 }),
      restocks: fc.array(fc.integer({ min: 0, max: 20 }), { maxLength: 2 }),
      dusk: fc.integer({ min: 0, max: 60 }),
      paid: fc.integer({ min: 0, max: 50 }),
      confidence: fc.double({ min: 0, max: 1, noNaN: true }),
    }),
    { selector: (i) => i.name, minLength: 1, maxLength: 5 },
  ),
  history: fc.array(fc.integer({ min: 1, max: 10 }), { maxLength: 2 }),
});

function reconcile(day: typeof dayArb extends fc.Arbitrary<infer D> ? D : never, alsoAllowed: number[] = []) {
  const catalogue = day.items.map((item, i) => ({ key: `item-${i}`, name: item.name, unitMinor: item.unitMinor }));
  const items = reconcileDay(catalogue, {
    morning: Object.fromEntries(day.items.map((item, i) => [`item-${i}`, item.morning])),
    restocks: [0, 1].map((r) => Object.fromEntries(day.items.map((item, i) => [`item-${i}`, item.restocks[r] ?? 0]))),
    dusk: Object.fromEntries(day.items.map((item, i) => [`item-${i}`, item.dusk])),
    duskConfidence: Object.fromEntries(day.items.map((item, i) => [`item-${i}`, item.confidence])),
    paid: Object.fromEntries(day.items.map((item, i) => [`item-${i}`, item.paid])),
  });
  const allowed = allowedNumbers(items, [...day.history, ...alsoAllowed]);
  return { items, allowed, names: catalogue.map((c) => c.name), template: templateExplanation(items, day.currency) };
}

/** A sentence that alternates filler words with the given pieces, so no two numbers touch. */
function sentenceArb(pieces: fc.Arbitrary<string>[]): fc.Arbitrary<string> {
  const filler = fc.array(fc.constantFrom(...FILLER), { minLength: 1, maxLength: 3 }).map((w) => w.join(" "));
  return fc
    .tuple(filler, ...pieces.map((p) => fc.tuple(p, filler)))
    .map(([first, ...rest]) => [first, ...rest.flat()].join(" "));
}

const legitArb = dayArb.chain((day) => {
  const r = reconcile(day);
  const piece = fc.oneof(
    fc.constantFrom(...r.names),
    fc.constantFrom(...r.allowed).chain((n) => fc.constantFrom(...renderings(n, day.currency))),
  );
  const text = fc
    .array(piece, { minLength: 1, maxLength: 6 })
    .chain((pieces) => sentenceArb(pieces.map((p) => fc.constant(p))));
  return fc.record({ r: fc.constant(r), text });
});

const injectedArb = fc.tuple(dayArb, fc.option(compositeArb, { freq: 3 })).chain(([day, composite]) => {
  const r = reconcile(day, composite?.allow);
  const permitted = new Set(r.allowed.map((n) => String(Math.abs(n))));
  const bad = fc
    .oneof(
      fc.integer({ min: 0, max: 9_999 }),
      fc.integer({ min: 1, max: 999_999 }).map((n) => n / 100),
      fc.constantFrom(0.25, 0.5, 0.75, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    )
    .filter((n) => !permitted.has(String(n)));
  const injected =
    composite && !permitted.has(String(composite.n))
      ? fc.constant({ n: composite.n, text: composite.text })
      : bad.chain((n) =>
          fc.record({ n: fc.constant(n), text: fc.constantFrom(...renderings(n, day.currency), ...trickyRenderings(n)) }),
        );
  const legit = fc.oneof(
    fc.constantFrom(...r.names),
    fc.constantFrom(...r.allowed).chain((n) => fc.constantFrom(...renderings(n, day.currency))),
  );
  return fc
    .tuple(fc.array(legit, { maxLength: 4 }), injected, fc.array(legit, { maxLength: 4 }))
    .chain(([before, inj, after]) =>
      sentenceArb([...before, inj.text, ...after].map((p) => fc.constant(p))).map((text) => ({ r, n: inj.n, text })),
    );
});

const newNumbersRejected = fc.property(injectedArb, ({ r, n, text }) => {
  const check = checkNumbers(text, r.allowed, r.names);
  assert(!check.ok, `"${text}" introduces ${n} but passed the check`);
});

const knownNumbersAccepted = fc.property(legitArb, ({ r, text }) => {
  const check = checkNumbers(text, r.allowed, r.names);
  assert(check.ok, `"${text}" uses only computed numbers but was rejected: ${JSON.stringify(check)}`);
});

const shownTextIsSafe = fc.property(
  dayArb.chain((day) => {
    const r = reconcile(day);
    return fc.record({
      r: fc.constant(r),
      modelText: fc.option(fc.oneof(fc.string({ unit: "binary", maxLength: 80 }), fc.string({ maxLength: 80 })), {
        nil: undefined,
      }),
    });
  }),
  ({ r, modelText }) => {
    assert(checkNumbers(r.template, r.allowed, r.names).ok, `the template "${r.template}" fails its own check`);
    const shown = explanationToShow(modelText, r.allowed, r.names, r.template);
    assert(shown.source === "template" || shown.text === modelText, "the model's text was altered");
    assert(checkNumbers(shown.text, r.allowed, r.names).ok, `shown text "${shown.text}" has a number code did not compute`);
  },
);

export const p5 = [
  moneyProperty(
    "E4.5",
    "The model's text never introduces a number that is not in the computed reconciliation",
    newNumbersRejected,
  ),
  moneyProperty("E4.5b", "Text that uses only computed numbers passes the check", knownNumbersAccepted),
  moneyProperty(
    "E4.5c",
    "Whatever the model writes, the text shown contains only computed numbers, and the fallback always passes",
    shownTextIsSafe,
  ),
];
