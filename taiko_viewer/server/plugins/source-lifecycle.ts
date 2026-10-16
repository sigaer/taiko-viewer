import { createManualSourceRecoveryWorker } from "../infrastructure/taiko-publication/recovery-worker";
import { recoverOneManualSourceLifecycle } from "../services/account/source-lifecycle-recovery";

import { useOwnedQaStartupIsolation } from "../infrastructure/qa-startup-isolation";

export default defineNitroPlugin(nitroApp => {
  if (import.meta.prerender) return;
  useOwnedQaStartupIsolation();
  const worker = createManualSourceRecoveryWorker(recoverOneManualSourceLifecycle);
  const timer = setInterval(() => { void worker.run(); }, 60_000);
  timer.unref();
  nitroApp.hooks.hook("close", async () => { clearInterval(timer); await worker.close(); });
  void worker.run();
});
