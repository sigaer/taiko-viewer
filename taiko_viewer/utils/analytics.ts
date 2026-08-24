const DYNAMIC_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/(songs)\/[^/]+$/, "/$1/:id"],
  [/^\/(forum\/thread)\/[^/]+$/, "/$1/:id"],
  [/^\/(forum\/section)\/[^/]+$/, "/$1/:slug"],
  [/^\/(guide)\/[^/]+\/[^/]+$/, "/$1/:difficulty/:level"],
  [/^\/(grade\/\d{4})\/[^/]+$/, "/$1/:grade"],
  [/^\/(annual\/share)\/[^/]+$/, "/$1/:token"],
  [/^\/(account\/annual-poster)\/[^/]+$/, "/$1/:summaryId"]
];

export const buildAnalyticsRouteTemplate = (input: string) => {
  const path = String(input || "/").split(/[?#]/, 1)[0] || "/";
  const localeMatch = path.match(/^\/(ja)(?=\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const routePath = localePrefix ? path.slice(localePrefix.length) || "/" : path;

  for (const [pattern, replacement] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(routePath)) {
      return `${localePrefix}${routePath.replace(pattern, replacement)}`;
    }
  }
  return `${localePrefix}${routePath}` || "/";
};

export const buildAnonymousPageLocation = (input: string) => {
  const routeTemplate = buildAnalyticsRouteTemplate(input);
  if (!process.client) return routeTemplate;
  return `${window.location.origin}${routeTemplate}`;
};

export const trackViewerEvent = (name: string, params: Record<string, string | number | boolean> = {}) => {
  if (!process.client || typeof window.gtag !== "function") return;
  window.gtag("event", name, {
    ...params,
    route_template: buildAnalyticsRouteTemplate(window.location.pathname)
  });
};
