export type MobileTab = "home" | "songs" | "my" | "more";

const normalizePath = (path: string) => {
  const withoutLocale = path === "/ja" ? "/" : path.startsWith("/ja/") ? path.slice(3) || "/" : path;
  return withoutLocale.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
};

export const resolveMobileTab = (path: string, mobileNavMeta?: unknown): MobileTab | null => {
  if (mobileNavMeta === false) return null;
  const normalizedPath = normalizePath(path);

  if (normalizedPath === "/") return "home";
  if (normalizedPath === "/my" || normalizedPath.startsWith("/my/")) return "my";
  if (normalizedPath === "/songs" || normalizedPath.startsWith("/songs/")) return "songs";

  if (
    normalizedPath === "/account/songs" ||
    normalizedPath.startsWith("/account/songs/") ||
    normalizedPath === "/account/version-summary" ||
    normalizedPath.startsWith("/account/annual-poster/") ||
    normalizedPath === "/tools/b30" ||
    normalizedPath === "/tools/recommend" ||
    normalizedPath === "/tools/progress" ||
    normalizedPath === "/tools/trend" ||
    normalizedPath === "/tools/word-cloud"
  ) {
    return "my";
  }

  return "more";
};

export const isImmersiveRoute = (path: string, mobileNavMeta?: unknown) => {
  if (mobileNavMeta === false) return true;
  const normalizedPath = normalizePath(path);
  return (
    normalizedPath.startsWith("/annual/share/") ||
    normalizedPath.startsWith("/account/annual-poster/") ||
    normalizedPath === "/account/version-summary"
  );
};

export const mobileTabLabelKey: Record<MobileTab, string> = {
  home: "nav.home",
  songs: "nav.songsTab",
  my: "nav.my",
  more: "nav.more"
};
