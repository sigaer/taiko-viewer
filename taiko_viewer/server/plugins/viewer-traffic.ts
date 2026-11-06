import { getViewerTrafficStore } from '../utils/admin/traffic-runtime';
import { useOwnedQaStartupIsolation } from '../infrastructure/qa-startup-isolation';

export default defineNitroPlugin(app => {
  if (import.meta.prerender || import.meta.dev) return;
  if (useOwnedQaStartupIsolation()) return;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;
  let lastWarning = 0;
  const run = () => {
    pending = (async () => {
      let backlog = false;
      try { backlog = await getViewerTrafficStore().ingest(); }
      catch {
        // No raw paths, queries, addresses or credentials in service logs.
        if (Date.now() - lastWarning > 60_000) {
          console.warn('[viewer-traffic] ingestion unavailable; dashboard freshness will report the delay');
          lastWarning = Date.now();
        }
      }
      if (!closed) { timer = setTimeout(run, backlog ? 250 : 30_000); timer.unref(); }
    })();
  };
  timer = setTimeout(run, 5_000);
  timer.unref();
  app.hooks.hook('close', async () => { closed = true; clearTimeout(timer); await pending; });
});
