import type { SetName, TruthSet } from "./truth";

export type EvalStatus = "pass" | "fail" | "skip";

export type PropertyResult = {
  id: string;
  claim: string;
  runs: number;
  passed: boolean;
  seed: number;
  counterexample?: string;
  error?: string;
};

export type EvalResult = {
  id: string;
  title: string;
  target: string;
  status: EvalStatus;
  /** Why it was skipped or failed. */
  reason?: string;
  /** What is missing before it can run. */
  needs?: string[];
  metrics?: Record<string, number>;
  properties?: PropertyResult[];
  /** One entry per photo for the photo evals: the truth, the model's reply, any error. */
  cases?: object[];
};

export type EvalContext = {
  root: string;
  /** fast-check seed for the property tests; set EVAL_SEED to replay a run. */
  seed: number;
  /** Generated cases per property; set EVAL_RUNS to change it. */
  runs: number;
  truth: Record<SetName, TruthSet>;
};

export type Eval = {
  id: string;
  title: string;
  target: string;
  run(ctx: EvalContext): Promise<EvalResult>;
};
