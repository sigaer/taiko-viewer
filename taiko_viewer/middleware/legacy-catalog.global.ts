import { legacyCatalogLocation } from "~/utils/rework/catalog";

// Client-side navigations to the old song list addresses end at the same place as the server's 302
// (server/middleware/legacy-catalog.ts). Both use legacyCatalogLocation.
export default defineNuxtRouteMiddleware((to) => {
  const target = legacyCatalogLocation(to.path, to.query);
  if (target) return navigateTo(target, { redirectCode: 302, replace: true });
});
