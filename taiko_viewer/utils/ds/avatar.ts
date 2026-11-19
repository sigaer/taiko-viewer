// Avatar source selection for the design-system PlayerAvatar (D0-7 = A, 04 §7.8, 22 D3).
//
// The account and forum APIs return a fixed URL when a user has no avatar
// (server/internal/{account,forum}/shared.ts DEFAULT_AVATAR). That URL loads successfully, so a component
// that only checked "is there a URL" would show it instead of the specified default. New components treat it
// as "no avatar" and show /default-avatar.svg. The server behaviour itself is unchanged in stage 0.

/** The server's placeholder avatar URL; must stay equal to DEFAULT_AVATAR in server/internal/{account,forum}/shared.ts. */
export const SERVER_DEFAULT_AVATAR_URL = "https://viewer.sakura-bot.cn/miku.png";

/** Hosts that serve the same placeholder file (the legacy forum domain redirects to the viewer domain). */
const PLACEHOLDER_HOSTS = new Set(["viewer.sakura-bot.cn", "forum.sakura-bot.cn"]);
const PLACEHOLDER_PATH = "/miku.png";

/** The specified default avatar for users without one (front-end public file, used as is). */
export const DS_DEFAULT_AVATAR_SRC = "/default-avatar.svg";

/** True when the URL is the server's "no avatar" placeholder (scheme and host case-insensitive, no query or hash). */
export function isServerDefaultAvatar(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const value = url.trim();
  if (!value) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return (
    (parsed.protocol === "https:" || parsed.protocol === "http:") &&
    PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase()) &&
    parsed.pathname === PLACEHOLDER_PATH &&
    !parsed.search &&
    !parsed.hash
  );
}

/** True when there is a user-uploaded avatar to show. */
export function hasUserAvatar(url: unknown): url is string {
  return typeof url === "string" && url.trim() !== "" && !isServerDefaultAvatar(url);
}

/** The image source to request first: the user's avatar, or the default avatar. Load failures fall back separately. */
export function resolveAvatarSrc(url: unknown): string {
  return hasUserAvatar(url) ? url.trim() : DS_DEFAULT_AVATAR_SRC;
}
