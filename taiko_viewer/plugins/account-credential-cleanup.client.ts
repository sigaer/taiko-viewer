import { removeLegacyAccountPassword } from "~/utils/rememberedAccountIdentifier";

export default defineNuxtPlugin(() => {
  // Runs on every client app start, including public routes and existing sessions.
  // Blocked storage is retried on the next start; never log credential contents.
  try { removeLegacyAccountPassword(localStorage); } catch { /* Storage unavailable. */ }
});
