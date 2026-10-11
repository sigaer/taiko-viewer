import assert from "node:assert/strict";
import test from "node:test";
import { createManualSourceRecoveryWorker } from "../server/infrastructure/taiko-publication/recovery-worker.ts";

test("recovery worker is single-flight, receives shutdown signal, and cannot admit work after close", async () => {
  let finish: () => void;
  let calls = 0;
  let signal: AbortSignal | undefined;
  const worker = createManualSourceRecoveryWorker(async input => {
    calls++; signal = input;
    await new Promise<void>(resolve => { finish = resolve; });
  });
  const first = worker.run();
  assert.equal(worker.run(), first);
  await Promise.resolve();
  assert.equal(calls, 1);
  const closing = worker.close();
  assert.equal(signal?.aborted, true);
  finish!();
  await closing;
  await worker.run();
  assert.equal(calls, 1);
});

test("recovery worker reports a bounded failure without passing private errors, then admits a retry", async () => {
  let calls = 0;
  let errors = 0;
  const worker = createManualSourceRecoveryWorker(async () => {
    if (++calls === 1) throw new Error("PRIVATE_METADATA");
  }, (...args) => { assert.equal(args.length, 0); errors++; });
  try { await worker.run(); await worker.run(); assert.equal(calls, 2); assert.equal(errors, 1); }
  finally { await worker.close(); }
});

test("closing before queued recovery begins cancels its admission", async () => {
  let calls = 0;
  const worker = createManualSourceRecoveryWorker(async () => { calls++; });
  worker.run();
  await worker.close();
  assert.equal(calls, 0);
});
