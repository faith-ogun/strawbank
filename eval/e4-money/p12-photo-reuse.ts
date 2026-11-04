import fc from "fast-check";
import { REUSE_DISTANCE, type PrintedSale, reuseVerdict } from "../../src/lib/photo-reuse";
import { assert, moneyProperty } from "./shared";

// A basket photo used for an earlier sale at the stand, used again (decided
// 4 Nov). The same bytes are refused at the till; a copy within REUSE_DISTANCE
// of its fingerprint (re-saved, shrunk, brightened) is let through but flagged;
// any other photo passes untouched. The closest earlier sale is the one named.
// The oracle below counts bits with BigInt, apart from the code under test.

const hexArb = (chars: number) => fc.stringMatching(new RegExp(`^[0-9a-f]{${chars}}$`));
const printArb = fc.record({ sha256: hexArb(64), dhash: hexArb(16) });
const saleArb = fc.record({ orderId: fc.stringMatching(/^[A-Z0-9]{17}$/), print: printArb });

const ZERO = BigInt(0);
const ONE = BigInt(1);

function bitsApart(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x !== ZERO) {
    n += Number(x & ONE);
    x >>= ONE;
  }
  return n;
}

function flip(dhash: string, bits: number[]): string {
  let x = BigInt(`0x${dhash}`);
  for (const bit of bits) x ^= ONE << BigInt(bit);
  return x.toString(16).padStart(16, "0");
}

// Half the time the new photo is made from an earlier one: the same bytes, or
// its fingerprint with a few bits changed, either side of the threshold.
const caseArb = fc.array(saleArb, { maxLength: 6 }).chain((earlier) =>
  fc.record({
    earlier: fc.constant(earlier as PrintedSale[]),
    print: earlier.length === 0
      ? printArb
      : fc.oneof(
          printArb,
          fc.constantFrom(...earlier).map((sale) => ({ ...sale.print })),
          fc
            .tuple(fc.constantFrom(...earlier), hexArb(64), fc.uniqueArray(fc.integer({ min: 0, max: 63 }), { maxLength: REUSE_DISTANCE + 3 }))
            .map(([sale, sha256, bits]) => ({ sha256, dhash: flip(sale.print.dhash, bits) })),
        ),
  }),
);

const reusedPhotoCaught = fc.property(caseArb, ({ earlier, print }) => {
  const verdict = reuseVerdict(print, earlier);
  const same = earlier.find((sale) => sale.print.sha256 === print.sha256);
  if (same) {
    assert(verdict.verdict === "same-photo", `a photo identical to sale ${same.orderId}'s was not refused`);
    assert(verdict.orderId === same.orderId, "the refusal names the wrong sale");
    return;
  }
  assert(verdict.verdict !== "same-photo", "a photo that differs from every earlier one was refused");
  const distances = earlier.map((sale) => bitsApart(sale.print.dhash, print.dhash));
  const closest = distances.length > 0 ? Math.min(...distances) : Infinity;
  if (closest <= REUSE_DISTANCE) {
    assert(verdict.verdict === "looks-like", `a copy ${closest} bits from an earlier sale's photo was not flagged`);
    assert(verdict.distance === closest, `the flag says ${verdict.distance} bits, the closest is ${closest}`);
    assert(earlier[distances.indexOf(closest)].orderId === verdict.orderId, "the flag names the wrong sale");
  } else {
    assert(verdict.verdict === "new", `a photo ${closest} bits from every earlier one was ${verdict.verdict}`);
  }
});

export const p12 = [
  moneyProperty(
    "E4.14",
    "A basket photo identical to an earlier sale's is refused, a copy within the fingerprint distance is flagged, and any other photo passes",
    reusedPhotoCaught,
  ),
];
