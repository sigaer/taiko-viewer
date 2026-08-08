import {
  cleanupAnnualCache,
  readCachedAnnualRatingDistribution,
  refreshAnnualRatingDistribution
} from "~/server/services/account/annual-summary/runtime";
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
  let lastRatingRefreshDate = "";
  const refreshRatingsIfDue = async () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((item) => [item.type, item.value]));
    const dateKey = `${value.year}-${value.month}-${value.day}`;
    const cached = await readCachedAnnualRatingDistribution();
    if (cached && (`${value.hour}:${value.minute}` < "03:30" || lastRatingRefreshDate === dateKey)) return;
    lastRatingRefreshDate = dateKey;
    await refreshAnnualRatingDistribution().catch((error) => {
      console.error("[annual-summary] scheduled rating refresh failed", error);
    });
  };
  void refreshRatingsIfDue();
  const maintenanceTimer = setInterval(() => {
    void maintainAnnualStorage().catch((error) => {
      console.error("[annual-summary] periodic maintenance failed", error);
    });
    void refreshRatingsIfDue();
  }, 15 * 60 * 1000);
  maintenanceTimer.unref();
  nitroApp.hooks.hook("close", () => clearInterval(maintenanceTimer));
});
