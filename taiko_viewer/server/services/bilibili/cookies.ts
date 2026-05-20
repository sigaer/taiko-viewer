import { BILIBILI_USER_AGENT } from "./constants";
import { bilibiliFetch } from "./fetch";

let cachedCookieHeader = "";
let cookieExpiresAt = 0;
const COOKIE_TTL_MS = 30 * 60 * 1000;

const parseSetCookieHeader = (value: string) => value.split(";")[0]?.trim() || "";

const mergeCookieParts = (...parts: string[]) => {
  const map = new Map<string, string>();
  for (const part of parts.join("; ").split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key) {
      map.set(key, value);
    }
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
};

const fetchFingerCookies = async (baseCookie: string) => {
  const response = await bilibiliFetch("https://api.bilibili.com/x/frontend/finger/spi", {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      ...(baseCookie ? { Cookie: baseCookie } : {})
    }
  });

  if (!response.ok) {
    return baseCookie;
  }

  const payload = (await response.json()) as {
    code?: number;
    data?: { b_3?: string; b_4?: string };
  };

  if (payload.code !== 0 || !payload.data?.b_3 || !payload.data?.b_4) {
    return baseCookie;
  }

  return mergeCookieParts(baseCookie, `buvid3=${payload.data.b_3}`, `buvid4=${payload.data.b_4}`);
};

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

  const initialCookie = setCookies.map(parseSetCookieHeader).filter(Boolean).join("; ");
  cachedCookieHeader = await fetchFingerCookies(initialCookie);
  cookieExpiresAt = Date.now() + COOKIE_TTL_MS;
  return cachedCookieHeader;
};
