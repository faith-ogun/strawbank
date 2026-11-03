// Gemini on Vertex usually answers in seconds, but now and then a call stalls
// until its timeout (seen on 3 Nov in shelf counts and in the ledger
// assistant's turns). A second try that starts while the first is still
// waiting turns most stalls into a short delay.

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
      call(controller.signal).then(resolve, (error) => (++failures === triesAtMs.length ? reject(error) : launch()));
    };
    for (const at of triesAtMs.slice(1)) timers.push(setTimeout(launch, at));
    launch();
  }).finally(() => {
    timers.forEach(clearTimeout);
    for (const controller of controllers) controller.abort();
  });
}

