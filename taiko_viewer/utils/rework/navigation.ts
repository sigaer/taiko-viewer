// Stage 1 destinations use current business routes until their replacement is
// integrated. No speculative endpoint or prototype router is used at runtime.
export const desktopDestinations = [
  { key: 'today', to: '/' },
  { key: 'songs', to: '/songs' },
  { key: 'play', to: '/account/songs' },
  { key: 'growth', to: '/my/growth' },
  { key: 'community', to: '/forum' },
  { key: 'tools', to: '/more' }
] as const;
export const mobileDestinations = [
  { key: 'today', to: '/' },
  { key: 'songs', to: '/songs' },
  { key: 'search', action: 'search' },
  { key: 'community', to: '/forum' },
  { key: 'my', to: '/my' }
] as const;
export type DestinationKey = typeof desktopDestinations[number]['key'];
export function withoutLocale(path: string): string {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return clean === '/ja' ? '/' : clean.startsWith('/ja/') ? clean.slice(3) : clean;
}
export function activeDestination(path: string): DestinationKey | null {
  const value = withoutLocale(path);
  const under = (root: string) => value === root || value.startsWith(root + '/');
  if (value === '/') return 'today';
  if (under('/songs') || under('/grade') || under('/guide') || under('/titles')) return 'songs';
  if (under('/account/songs') || ['/tools/b30','/tools/trend','/tools/progress','/tools/recommend'].includes(value)) return 'play';
  if (under('/my/growth') || under('/my/weekly')) return 'growth';
  if (under('/forum')) return 'community';
  if (['/more','/settings','/about'].includes(value) || under('/tools')) return 'tools';
  return null;
}

export const alternateLocale = (locale: string): "zh" | "ja" => locale === "ja" ? "zh" : "ja";

/**
 * Slice F: the destinations of /more (the tools entry; /tools redirects here), grouped as the shell groups them:
 * the library's secondary pages, the tools group (the same pages as the 工具 tabs), then the account and support pages
 * that have no tab of their own. Each label is the destination page's own title key.
 */
export const MORE_GROUPS = [
  {
    key: "songs",
    titleKey: "rework.songs",
    items: [
      { path: "/grade", labelKey: "rework.grade" },
      { path: "/guide", labelKey: "rework.guide" },
      { path: "/titles", labelKey: "rework.titles" }
    ]
  },
  {
    key: "tools",
    titleKey: "rework.tools",
    items: [
      { path: "/tools/rt-calculator", labelKey: "tools.rtCalculator" },
      { path: "/tools/chart-config", labelKey: "tools.chartConfig" },
      { path: "/tools/tja-constants", labelKey: "tools.tjaConstants" },
      { path: "/tools/note-count", labelKey: "tools.noteCount" },
      { path: "/tools/word-cloud", labelKey: "tools.wordCloud" },
      { path: "/settings", labelKey: "nav.settings" },
      { path: "/about", labelKey: "nav.about" }
    ]
  },
  {
    key: "account",
    titleKey: "nav.accountGroup",
    items: [
      { path: "/account/sync", labelKey: "account.sync" },
      { path: "/docs/score-token", labelKey: "rework.account.scoreTokenDocs.title" },
      { path: "/account/developer", labelKey: "rework.account.developer.title" }
    ]
  },
  {
    key: "support",
    titleKey: "nav.support",
    items: [
      { path: "/support", labelKey: "rework.account.support.introTitle" },
      { path: "/alias-log", labelKey: "nav.aliasLog" }
    ]
  }
] as const;

/** Slice F: the tools group's secondary tabs (the shell), labelled with the pages' own titles. */
export const TOOLS_TABS = [
  { key: "tools", to: "/more", labelKey: "rework.tools" },
  { key: "rtCalculator", to: "/tools/rt-calculator", labelKey: "tools.rtCalculator" },
  { key: "chartConfig", to: "/tools/chart-config", labelKey: "tools.chartConfig" },
  { key: "tjaConstants", to: "/tools/tja-constants", labelKey: "tools.tjaConstants" },
  { key: "noteCount", to: "/tools/note-count", labelKey: "tools.noteCount" },
  { key: "wordCloud", to: "/tools/word-cloud", labelKey: "tools.wordCloud" },
  { key: "settings", to: "/settings", labelKey: "nav.settings" },
  { key: "about", to: "/about", labelKey: "nav.about" }
] as const;

/** Slice F: the library's secondary tabs. `prefix` tabs are current on their sub-pages too (/grade/2026/…, /guide/4/10). */
export const SONGS_TABS = [
  { key: "catalog", to: "/songs", labelKey: "rework.catalog" },
  { key: "constants", to: "/songs/constants", labelKey: "rework.constants" },
  { key: "grade", to: "/grade", labelKey: "rework.grade", prefix: true },
  { key: "guide", to: "/guide", labelKey: "rework.guide", prefix: true },
  { key: "titles", to: "/titles", labelKey: "rework.titles" }
] as const;

/** Whether a secondary tab is the current page for a path without locale. */
export function tabCurrent(tab: { to: string; prefix?: boolean }, path: string): boolean {
  return path === tab.to || (Boolean(tab.prefix) && path.startsWith(tab.to + "/"));
}
