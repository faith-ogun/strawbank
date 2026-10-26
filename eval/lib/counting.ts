// Scoring for the counting evals (E1 baskets, later E3 shelves): how far the
// model's counts are from the truth files. Pure code, so it is the same on
// every run.

export type CountCase = {
  id: string;
  truth: Record<string, number>;
  /** Missing when the model call failed. */
  counted?: Record<string, number>;
  /** The model marked every count as sure, and raised no problem with the photo. */
  sure: boolean;
};

export type CountScore = {
  cases: number;
  /** Model calls that failed; each counts as a basket that was not exact. */
  errors: number;
  /** Every item count right. */
  exact: number;
  exactRate: number;
  /** Mean of |counted - true| over every item of every counted photo. */
  meanItemError: number;
  /** The largest total |counted - true| in one photo. */
  worstError: number;
  /** Photos whose total error is more than one item. */
  offByMoreThanOne: number;
  sure: number;
  sureExact: number;
  /** Of the photos marked sure, the share that was exact. Missing when none was sure. */
  sureExactRate?: number;
};

/** Total |counted - true| per photo, over every listed item. */
export function photoError(keys: string[], truth: Record<string, number>, counted: Record<string, number>): number {
  return keys.reduce((sum, key) => sum + Math.abs((counted[key] ?? 0) - (truth[key] ?? 0)), 0);
}

export function scoreCounts(keys: string[], cases: CountCase[]): CountScore {
  const counted = cases.filter((c): c is CountCase & { counted: Record<string, number> } => c.counted !== undefined);
  const errors = counted.map((c) => photoError(keys, c.truth, c.counted));
  const exactIds = new Set(counted.filter((_, i) => errors[i] === 0).map((c) => c.id));
  const sure = counted.filter((c) => c.sure);
  const sureExact = sure.filter((c) => exactIds.has(c.id)).length;
  const itemCount = counted.length * keys.length;

  return {
    cases: cases.length,
    errors: cases.length - counted.length,
    exact: exactIds.size,
    exactRate: cases.length > 0 ? exactIds.size / cases.length : 0,
    meanItemError: itemCount > 0 ? errors.reduce((a, b) => a + b, 0) / itemCount : 0,
    worstError: Math.max(0, ...errors),
    offByMoreThanOne: errors.filter((e) => e > 1).length,
    sure: sure.length,
    sureExact,
    ...(sure.length > 0 && { sureExactRate: sureExact / sure.length }),
  };
}
