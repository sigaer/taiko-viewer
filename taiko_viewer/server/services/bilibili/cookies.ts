import { BILIBILI_USER_AGENT } from "./constants";
import { bilibiliFetch } from "./fetch";

let cachedCookieHeader = "";
let cookieExpiresAt = 0;
const COOKIE_TTL_MS = 30 * 60 * 1000;

const parseSetCookieHeader = (value: string) => value.split(";")[0]?.trim() || "";

export const getBilibiliCookieHeader = async () => {
  if (cachedCookieHeader && Date.now() < cookieExpiresAt) {
    return cachedCookieHeader;
  }

  const response = await bilibiliFetch("https://www.bilibili.com/", {
    headers: { "User-Agent": BILIBILI_USER_AGENT }
  });

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  const cookieParts = setCookies.map(parseSetCookieHeader).filter(Boolean);
  cachedCookieHeader = cookieParts.join("; ");
  cookieExpiresAt = Date.now() + COOKIE_TTL_MS;
  return cachedCookieHeader;
};
