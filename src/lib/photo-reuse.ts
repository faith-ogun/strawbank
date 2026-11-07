// A basket photo used for an earlier sale at the stand, used again (decided
// 4 Nov; property E4.14, eval E6). The same bytes are refused at the till. A
// copy whose fingerprint is within REUSE_DISTANCE bits of an earlier sale's
// (the same photo re-saved, shrunk or brightened) is let through, because two
// honest baskets in the same tub can look alike, but the order is flagged and
// the agent never refunds it alone (E4.2d). A fresh photo of a similar basket
// is not a reused photo, and passes.

/** The photo's SHA-256, and a 64-bit difference hash of its light and dark, both as hex. */
export type PhotoPrint = { sha256: string; dhash: string };

export type PrintedSale = { orderId: string; print: PhotoPrint };

export type ReuseVerdict =
  | { verdict: "new" }
  | { verdict: "same-photo"; orderId: string }
  | { verdict: "looks-like"; orderId: string; distance: number };

/**
 * On the eval photos (4 Nov), a re-saved, shrunk or brightened copy was at
 * most 4 bits from its original, and no two different photos were closer than
 * 8. A cropped copy, or one with a screenshot's bars, can be further: up to 12.
 * Two shots of one lemon taken a second apart (7 Nov) were 4 bits apart, so a
 * burst shot of the same thing is flagged like a copy, and that is intended.
 */
export const REUSE_DISTANCE = 5;

/** What the customer is told when the photo is one an earlier sale already used. */
export const REUSED_REFUSAL = "This photo was used for an earlier sale. Take a new photo of what you're taking now. The photo was not kept.";

/** How many bits differ between two difference hashes. */
export function hamming(a: string, b: string): number {
  let bits = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    let x = parseInt(a[i] ?? "0", 16) ^ parseInt(b[i] ?? "0", 16);
    for (; x; x &= x - 1) bits++;
  }
  return bits;
}

/** The same bytes as an earlier sale's photo, then the closest copy within REUSE_DISTANCE, else new. */
export function reuseVerdict(print: PhotoPrint, earlier: PrintedSale[]): ReuseVerdict {
  const same = earlier.find((sale) => sale.print.sha256 === print.sha256);
  if (same) return { verdict: "same-photo", orderId: same.orderId };
  let closest: { orderId: string; distance: number } | undefined;
  for (const sale of earlier) {
    const distance = hamming(sale.print.dhash, print.dhash);
    if (distance <= REUSE_DISTANCE && (!closest || distance < closest.distance)) closest = { orderId: sale.orderId, distance };
  }
  return closest ? { verdict: "looks-like", ...closest } : { verdict: "new" };
}
