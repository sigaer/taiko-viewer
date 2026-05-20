import {
  BILIBILI_USER_AGENT,
  DYNAMIC_CACHE_TTL_MS,
  DYNAMIC_FEATURES
} from "./constants";
import { getCachedDynamic, setCachedDynamic } from "./cache";
import { getBilibiliCookieHeader } from "./cookies";
import { bilibiliFetch } from "./fetch";
import { signWbiParams } from "./wbi";

const getBilibiliAuthHeaders = async () => {
  const runtimeConfig = useRuntimeConfig();
  const sessData = String(runtimeConfig.bilibiliSessData || "");
  const cookieString = String(runtimeConfig.bilibiliCookie || "");
  const cookieParts: string[] = [];

  if (cookieString) {
    cookieParts.push(cookieString);
  } else if (sessData) {
    cookieParts.push(`SESSDATA=${sessData}`);
  } else {
    const guestCookie = await getBilibiliCookieHeader();
    if (guestCookie) {
      cookieParts.push(guestCookie);
    }
  }

  if (!cookieParts.length) {
    return {};
  }

  return { Cookie: cookieParts.join("; ") };
};

export const fetchSpaceDynamics = async (uid: string) => {
  const cacheKey = `dynamic:${uid}`;
  const cached = getCachedDynamic<unknown>(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    host_mid: uid,
    platform: "web",
    web_location: "0.0",
    dm_img_list: "[]",
    dm_img_str: "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ",
    dm_cover_img_str:
      "QU5HTEUgKEFNRCwgQU1EIFJhZGVvbiA3ODBNIEdyYXBoaWNzICgweDAwMDAxNUJGKSBEaXJlY3QzRDExIHZzXzVfMCBwc181XzAsIEQzRDExKUdvb2dsZSBJbmMuIChBTU",
    features: DYNAMIC_FEATURES
  });

  const signedParams = await signWbiParams(params);
  const targetUrl = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${signedParams.toString()}`;

  const authHeaders = await getBilibiliAuthHeaders();
  const response = await bilibiliFetch(targetUrl, {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: `https://space.bilibili.com/${uid}/dynamic`,
      Origin: "https://space.bilibili.com",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      ...authHeaders
    }
  });

  const body = (await response.json()) as { code?: number; message?: string };

  if (!response.ok && body.code === undefined) {
    throw createError({
      statusCode: 502,
      statusMessage: `Bilibili API Error: ${response.status}`
    });
  }
  if (body.code === 0) {
    setCachedDynamic(cacheKey, body, DYNAMIC_CACHE_TTL_MS);
  }

  return body;
};
