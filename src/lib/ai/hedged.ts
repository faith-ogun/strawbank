// Gemini on Vertex usually answers in seconds, but now and then a call stalls
// until its timeout (seen on 3 Nov in shelf counts and in the ledger
// assistant's turns). A second try that starts while the first is still
// waiting turns most stalls into a short delay.
//
// A try that fails starts the next at once, except when Vertex says it is too
// busy (429, "Resource exhausted"; seen 9 Nov on a refund recount): an instant
// second try is refused too, so the next one waits BUSY_WAIT_MS.

/** How long to wait after Vertex says it is too busy, before the next try. */
export const BUSY_WAIT_MS = 1_500;

/** True for Vertex's "too busy" answer: HTTP 429, or its "Resource exhausted" message. */
export function isBusy(error: unknown): boolean {
  const status = (error as { statusCode?: number; status?: number } | undefined)?.statusCode ?? (error as { status?: number } | undefined)?.status;
  return status === 429 || (error instanceof Error && /resource exhausted|\b429\b/i.test(error.message));
}

/**
 * Runs `call` at each of `triesAtMs` (milliseconds from the start) until one
 * answers; a failed try starts the next one at once. The first answer wins and
 * the others are cancelled; it fails only if every try does.
 */
export function hedged<T>(call: (signal: AbortSignal) => Promise<T>, triesAtMs: number[]): Promise<T> {
  const controllers: AbortController[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  return new Promise<T>((resolve, reject) => {
    let failures = 0;
    const launch = () => {
      if (controllers.length === triesAtMs.length) return;
      const controller = new AbortController();
      controllers.push(controller);
      call(controller.signal).then(resolve, (error) => {
        if (++failures === triesAtMs.length) return reject(error);
        if (isBusy(error)) timers.push(setTimeout(launch, BUSY_WAIT_MS));
        else launch();
      });
    };
    for (const at of triesAtMs.slice(1)) timers.push(setTimeout(launch, at));
    launch();
  }).finally(() => {
    timers.forEach(clearTimeout);
    for (const controller of controllers) controller.abort();
  });
}

