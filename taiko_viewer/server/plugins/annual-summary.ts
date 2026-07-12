import { cleanupAnnualCache } from "~/server/services/account/annual-summary/runtime";
import { maintainAnnualStorage, recoverAnnualJobs } from "~/server/services/account/annual-summary";
import { assertAnnualSecurityConfiguration } from "~/server/services/account/annual-summary/security";
import { assertAccountDbConfiguration, closeAccountDb } from "~/server/utils/account-db";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("close", closeAccountDb);
  if (import.meta.prerender) return;
  assertAccountDbConfiguration();
  assertAnnualSecurityConfiguration();
  void cleanupAnnualCache().catch((error) => {
    console.error("[annual-summary] cache cleanup failed", error);
  });
  void recoverAnnualJobs().catch((error) => {
    console.error("[annual-summary] persisted job recovery failed", error);
  });
  const maintenanceTimer = setInterval(() => {
    void maintainAnnualStorage().catch((error) => {
      console.error("[annual-summary] periodic maintenance failed", error);
    });
  }, 15 * 60 * 1000);
  maintenanceTimer.unref();
  nitroApp.hooks.hook("close", () => clearInterval(maintenanceTimer));
});
