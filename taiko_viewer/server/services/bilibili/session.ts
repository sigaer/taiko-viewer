import { readFile } from "node:fs/promises";
import { BILIBILI_USER_AGENT } from "./constants";
import { getBilibiliCookieHeader } from "./cookies";
import { bilibiliFetch } from "./fetch";

type NavResponse = {
  code?: number;
  data?: {
    mid?: number;
    uname?: string;
  };
};

let cachedSessData = "";
let cachedLoginMid = 0;
let sessionExpiresAt = 0;
const SESSION_TTL_MS = 10 * 60 * 1000;

const getSessDataFilePath = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(
    runtimeConfig.bilibiliSessDataFile ||
      process.env.BILIBILI_SESSDATA_FILE ||
      "/home/sigaer/bilisess.txt"
  ).trim();
};

const loadSessDataFromFile = async () => {
  const inlineSessData = String(useRuntimeConfig().bilibiliSessData || process.env.BILIBILI_SESSDATA || "").trim();
  if (inlineSessData) {
    return inlineSessData;
  }

  const filePath = getSessDataFilePath();
  if (!filePath) {
    return "";
  }

  try {
    return (await readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
};

const resolveLoginMid = async (sessData: string, cookieString: string) => {
  const runtimeConfig = useRuntimeConfig();
  const configuredMid = Number(runtimeConfig.bilibiliLoginMid || process.env.BILIBILI_LOGIN_MID || 0);
  if (configuredMid > 0) {
    return configuredMid;
  }

  if (cachedLoginMid > 0 && Date.now() < sessionExpiresAt) {
    return cachedLoginMid;
  }

  const cookieParts = [cookieString];
  if (sessData) {
    cookieParts.unshift(`SESSDATA=${sessData}`);
  }

  const response = await bilibiliFetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      Cookie: cookieParts.filter(Boolean).join("; ")
    }
  });

  if (!response.ok) {
    return 0;
  }

  const nav = (await response.json()) as NavResponse;
  const mid = Number(nav.data?.mid || 0);
  if (nav.code === 0 && mid > 0) {
    cachedLoginMid = mid;
    sessionExpiresAt = Date.now() + SESSION_TTL_MS;
    return mid;
  }

  return 0;
};

export const getBilibiliAuthCookieHeader = async () => {
  const runtimeConfig = useRuntimeConfig();
  const cookieString = String(runtimeConfig.bilibiliCookie || process.env.BILIBILI_COOKIE || "").trim();
  if (cookieString) {
    return cookieString;
  }

  const sessData = await loadSessDataFromFile();
  const guestCookie = await getBilibiliCookieHeader();
  if (!sessData) {
    return guestCookie;
  }

  const loginMid = await resolveLoginMid(sessData, guestCookie);
  const authParts = [`SESSDATA=${sessData}`];
  if (loginMid > 0) {
    authParts.push(`DedeUserID=${loginMid}`);
  }
  if (guestCookie) {
    authParts.push(guestCookie);
  }

  return authParts.join("; ");
};

export const hasBilibiliLoginSession = async () => Boolean(await loadSessDataFromFile());
