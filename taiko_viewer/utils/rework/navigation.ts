// The one navigation model of the shell (redesign v2, 2026-11-27). The desktop sidebar, the tablet drawer, the
// section tabs, the phone bottom bar, the /more hub and the search panel's page results all read these lists; no
// component keeps a second hand-written list. Addresses are the current business routes (no address changes).
// Each entry is labelled with its destination page's own title key; `icon` names a ReworkIcon path.

export type NavItem = {
  key: string;
  to: string;
  labelKey: string;
  icon: string;
  /** Current on its sub-pages too (/grade/2026/…, /guide/4/10, /forum/thread/…). */
  prefix?: boolean;
};
export type NavGroupKey = "songs" | "scores" | "tools";
export type NavGroup = { kind: "group"; key: NavGroupKey; labelKey: string; icon: string; items: readonly NavItem[] };
export type NavLink = NavItem & { kind: "link" };
export type NavEntry = NavLink | NavGroup;

/** 曲库: the library's pages. */
export const SONGS_TABS = [
  { key: "catalog", to: "/songs", labelKey: "rework.catalog", icon: "music" },
  { key: "constants", to: "/songs/constants", labelKey: "rework.constants", icon: "table" },
  { key: "grade", to: "/grade", labelKey: "rework.grade", icon: "medal", prefix: true },
  { key: "guide", to: "/guide", labelKey: "rework.guide", icon: "book", prefix: true },
  { key: "titles", to: "/titles", labelKey: "rework.titles", icon: "tag" }
] as const;

/** 我的成绩: the former 成绩 tabs (PLAY_TABS) followed by the former 成长 tabs (GROWTH_TABS). */
export const SCORES_TABS = [
  { key: "scores", to: "/account/songs", labelKey: "rework.scores", icon: "list" },
  { key: "b30", to: "/tools/b30", labelKey: "rework.b30", icon: "bars" },
  { key: "trend", to: "/tools/trend", labelKey: "rework.trend", icon: "trend" },
  { key: "progress", to: "/tools/progress", labelKey: "rework.progress", icon: "grid" },
  { key: "recommend", to: "/tools/recommend", labelKey: "rework.recommend", icon: "star" },
  { key: "passport", to: "/my/growth", labelKey: "rework.passport", icon: "sprout" },
  { key: "weekly", to: "/my/weekly", labelKey: "rework.weekly", icon: "calendar" }
] as const;

/** 工具: the tool pages, labelled with the pages' own titles. */
export const TOOLS_TABS = [
  { key: "rtCalculator", to: "/tools/rt-calculator", labelKey: "tools.rtCalculator", icon: "calc" },
  { key: "chartConfig", to: "/tools/chart-config", labelKey: "tools.chartConfig", icon: "config" },
  { key: "tjaConstants", to: "/tools/tja-constants", labelKey: "tools.tjaConstants", icon: "file" },
  { key: "noteCount", to: "/tools/note-count", labelKey: "tools.noteCount", icon: "hash" },
  { key: "wordCloud", to: "/tools/word-cloud", labelKey: "tools.wordCloud", icon: "cloud" }
] as const;

export const NAV_GROUPS: readonly NavGroup[] = [
  { kind: "group", key: "songs", labelKey: "rework.songs", icon: "music", items: SONGS_TABS },
  { kind: "group", key: "scores", labelKey: "rework.shell.myScores", icon: "bars", items: SCORES_TABS },
  { kind: "group", key: "tools", labelKey: "rework.tools", icon: "tools", items: TOOLS_TABS }
];
const group = (key: NavGroupKey) => NAV_GROUPS.find((g) => g.key === key)!;

/** The main navigation, in order: 今日, 曲库, 我的成绩, 社区, 工具. */
export const MAIN_NAV: readonly NavEntry[] = [
  { kind: "link", key: "today", to: "/", labelKey: "rework.today", icon: "today" },
  group("songs"),
  group("scores"),
  { kind: "link", key: "community", to: "/forum", labelKey: "rework.community", icon: "community", prefix: true },
  group("tools")
];

/** The hub of every feature (/more). Last entry of the sidebar, 全部 on the phone bottom bar. */
export const ALL_FEATURES: NavItem = { key: "all", to: "/more", labelKey: "rework.shell.allFeatures", icon: "tools" };

/** Sidebar footer links. */
export const FOOTER_LINKS = [
  { key: "settings", to: "/settings", labelKey: "nav.settings", icon: "settings" },
  { key: "support", to: "/support", labelKey: "rework.account.support.introTitle", icon: "support" },
  { key: "about", to: "/about", labelKey: "nav.about", icon: "info" }
] as const;

/** Account-level pages without a place in the main navigation. */
export const ACCOUNT_LINKS = [
  { key: "sync", to: "/account/sync", labelKey: "account.sync", icon: "sync" },
  { key: "scoreToken", to: "/docs/score-token", labelKey: "rework.account.scoreTokenDocs.title", icon: "key" },
  { key: "developer", to: "/account/developer", labelKey: "rework.account.developer.title", icon: "code" },
  { key: "aliasLog", to: "/alias-log", labelKey: "nav.aliasLog", icon: "history" }
] as const;

/** Personal pages reached from the account menu and the hub (/my keeps the annual entry; /forum/me has no other link on desktop). */
export const PERSONAL_LINKS = [
  { key: "myTaiko", to: "/my", labelKey: "nav.myTaiko", icon: "my" },
  { key: "myPosts", to: "/forum/me", labelKey: "rework.myPosts", icon: "community" }
] as const;

/** 账号与支持 on /more, in order. */
export const SUPPORT_LINKS: readonly NavItem[] = [
  ...PERSONAL_LINKS,
  ACCOUNT_LINKS[0],
  ACCOUNT_LINKS[1],
  ACCOUNT_LINKS[2],
  FOOTER_LINKS[1],
  ACCOUNT_LINKS[3],
  FOOTER_LINKS[0],
  FOOTER_LINKS[2]
];

/** Phone bottom bar: 今日, 曲库, 成绩, 社区, 全部. */
export const MOBILE_TABS = [
  { key: "today", to: "/", labelKey: "rework.today", icon: "today" },
  { key: "songs", to: "/songs", labelKey: "rework.songs", icon: "music" },
  { key: "scores", to: "/account/songs", labelKey: "rework.play", icon: "bars" },
  { key: "community", to: "/forum", labelKey: "rework.community", icon: "community" },
  { key: "all", to: "/more", labelKey: "rework.shell.all", icon: "tools" }
] as const;
export type MobileTabKey = (typeof MOBILE_TABS)[number]["key"];

export type Feature = NavItem & { groupKey?: string };
/** Every page of the model with the name of its group: the search panel's page results. */
export const FEATURES: readonly Feature[] = [
  { ...(MAIN_NAV[0] as NavLink) },
  ...group("songs").items.map((i) => ({ ...i, groupKey: "rework.songs" })),
  ...group("scores").items.map((i) => ({ ...i, groupKey: "rework.shell.myScores" })),
  { ...(MAIN_NAV[3] as NavLink) },
  ...group("tools").items.map((i) => ({ ...i, groupKey: "rework.tools" })),
  ...SUPPORT_LINKS.map((i) => ({ ...i, groupKey: "rework.shell.accountSupport" })),
  { ...ALL_FEATURES }
];
/** The search panel's empty-query list. */
export const COMMON_FEATURES: readonly Feature[] = [
  { key: "syncScores", to: "/account/sync", labelKey: "rework.shell.syncScores", icon: "sync", groupKey: "rework.shell.accountSupport" },
  ...["b30", "recommend", "rtCalculator", "grade"].map((key) => FEATURES.find((f) => f.key === key)!)
];

export function withoutLocale(path: string): string {
  const clean = path.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  return clean === '/ja' ? '/' : clean.startsWith('/ja/') ? clean.slice(3) : clean;
}

export type DestinationKey = "today" | NavGroupKey | "community";
/** The main-navigation entry a path belongs to (null: account, support and hub pages outside the main groups). */
export function activeDestination(path: string): DestinationKey | null {
  const value = withoutLocale(path);
  const under = (root: string) => value === root || value.startsWith(root + '/');
  if (value === '/') return 'today';
  if (under('/songs') || under('/grade') || under('/guide') || under('/titles')) return 'songs';
  if (under('/account/songs') || ['/tools/b30', '/tools/trend', '/tools/progress', '/tools/recommend'].includes(value) || under('/my/growth') || under('/my/weekly')) return 'scores';
  if (under('/forum')) return 'community';
  if (TOOLS_TABS.some((t) => under(t.to))) return 'tools';
  return null;
}

/** The phone bottom bar's current tab: anything outside the first four is 全部. */
export function mobileTab(path: string): MobileTabKey {
  const d = activeDestination(path);
  return d === 'today' || d === 'songs' || d === 'scores' || d === 'community' ? d : 'all';
}

/**
 * Pages outside the rework that still render in the default layout (slice G). The shell gives every other page the
 * V1.3 Element Plus mapping (`rework-ep` on <html>); these keep the old Element Plus colours and page background.
 * /annual is the annual entry (out of scope, renders in the default layout); /admin paths normally use their own
 * layout and are listed so that one falling back to the default layout is not restyled either.
 */
export const LEGACY_PAGES = ['/annual'] as const;
export const LEGACY_PREFIXES = ['/admin'] as const;
export function isLegacyPage(path: string): boolean {
  const value = withoutLocale(path);
  return (LEGACY_PAGES as readonly string[]).includes(value) || LEGACY_PREFIXES.some((p) => value === p || value.startsWith(p + '/'));
}

export const alternateLocale = (locale: string): "zh" | "ja" => locale === "ja" ? "zh" : "ja";

/** Whether a navigation item is the current page for a path without locale. */
export function tabCurrent(tab: { to: string; prefix?: boolean }, path: string): boolean {
  return path === tab.to || (Boolean(tab.prefix) && path.startsWith(tab.to + "/"));
}
