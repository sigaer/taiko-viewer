import { createManualSourceRecoveryWorker } from "../infrastructure/taiko-publication/recovery-worker";
import { recoverOneManualSourceDeletion } from "../services/account/manual-lifecycle";

export default defineNitroPlugin(nitroApp => {
  if (import.meta.prerender) return;
  const worker = createManualSourceRecoveryWorker(recoverOneManualSourceDeletion);
  const timer = setInterval(() => { void worker.run(); }, 60_000);
  timer.unref();
  nitroApp.hooks.hook("close", async () => { clearInterval(timer); await worker.close(); });
  void worker.run();
});
