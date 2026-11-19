import { defineEventHandler, getQuery, getRequestURL, sendRedirect } from "h3";
import { legacyCatalogHref } from "../../utils/rework/catalog.ts";

// Old song list addresses answer with a real 302 + Location before any page rendering:
// /songs/{available,removed,other} → /songs?shelf=…, /songs/v2-constants → /songs/constants (locale and query kept).
const LEGACY = /^(?:\/ja)?\/songs\/(?:available|removed|other|v2-constants)\/*$/;

export default defineEventHandler((event) => {
  if (event.method !== "GET" && event.method !== "HEAD") return;
  const { pathname } = getRequestURL(event);
  if (!LEGACY.test(pathname)) return;
  const location = legacyCatalogHref(pathname, getQuery(event) as Record<string, string | string[]>);
  if (location) return sendRedirect(event, location, 302);
});
