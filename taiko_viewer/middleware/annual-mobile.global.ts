import { annualEntryTarget, isAnnualMobileBrowser } from "~/utils/annualDevice";

export default defineNuxtRouteMiddleware((to) => {
  const target = annualEntryTarget(to.path);
  if (!target) return;
  const userAgent = import.meta.server ? useRequestHeaders(["user-agent"])["user-agent"] || "" : navigator.userAgent;
  const touchPoints = import.meta.client ? navigator.maxTouchPoints : 0;
  if (isAnnualMobileBrowser(userAgent, touchPoints)) return;
  // Redirect before the report's setup can request or build a summary. On the
  // client, the notice can distinguish desktop-mode iPads and resume their entry.
  return navigateTo({
    path: to.path.startsWith("/ja/") ? "/ja" : "/",
    query: { annualMobileOnly: target }
  }, { replace: true });
});
