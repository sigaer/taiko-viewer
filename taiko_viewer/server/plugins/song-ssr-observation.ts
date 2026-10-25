import { createSongSsrObserver } from "../services/content/songSsrObservation";

export default defineNitroPlugin((nitroApp) => {
  const observe = createSongSsrObserver(record => {
    console.error("[song-ssr-error]", JSON.stringify(record));
  });
  nitroApp.hooks.hook("error", (error, context) => {
    if (!context.event) return;
    // Diagnostics must never change the failing response or recovery path.
    try { observe(error, context.event); } catch { /* Discard unsafe diagnostics. */ }
  });
});
