/** Single-flight, one identity per tick, with explicit shutdown ownership. */
export function createManualSourceRecoveryWorker(
  recover: (signal: AbortSignal) => Promise<unknown>,
  onError: () => void = () => console.error("[score-lifecycle] persisted cleanup needs retry")
) {
  const stop = new AbortController();
  let closed = false;
  let running: Promise<void> | undefined;
  return {
    run() {
      if (closed) return Promise.resolve();
      if (!running) running = Promise.resolve().then(() => closed ? undefined : recover(stop.signal)).then(() => undefined, () => {
        if (!closed) onError();
      }).finally(() => { running = undefined; });
      return running;
    },
    async close() {
      closed = true;
      stop.abort();
      await running;
    }
  };
}
