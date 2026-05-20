import { createHash } from "node:crypto";
import { BILIBILI_USER_AGENT, WBI_CACHE_TTL_MS } from "./constants";
import { getBilibiliCookieHeader } from "./cookies";
import { bilibiliFetch } from "./fetch";

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12,
  38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62,
  11, 36, 20, 34, 44, 52
];

type WbiKeys = {
  mixin: string;
  expiresAt: number;
};

let cachedKeys: WbiKeys | null = null;

type NavResponse = {
  code: number;
  message: string;
  data?: {
    wbi_img?: {
      img_url?: string;
      sub_url?: string;
    };
  };
};

const extractKeyFromUrl = (url: string) => {
  const filename = url.split("/").pop() || "";
  return filename.replace(/\.png$/i, "");
};

const buildMixinKey = (imgKey: string, subKey: string) => {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.map((index) => raw[index])
    .join("")
    .slice(0, 32);
};

const fetchWbiKeys = async (): Promise<string> => {
  const cookieHeader = await getBilibiliCookieHeader();
  const response = await bilibiliFetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: {
      "User-Agent": BILIBILI_USER_AGENT,
      ...(cookieHeader ? { Cookie: cookieHeader } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`nav api status: ${response.status}`);
  }

  const nav = (await response.json()) as NavResponse;
  const imgUrl = nav.data?.wbi_img?.img_url || "";
  const subUrl = nav.data?.wbi_img?.sub_url || "";
  if (!imgUrl || !subUrl) {
    throw new Error("empty wbi urls");
  }

  const imgKey = extractKeyFromUrl(imgUrl);
  const subKey = extractKeyFromUrl(subUrl);
  return buildMixinKey(imgKey, subKey);
};

export const getWbiMixinKey = async () => {
  if (cachedKeys && Date.now() < cachedKeys.expiresAt) {
    return cachedKeys.mixin;
  }

  const mixin = await fetchWbiKeys();
  cachedKeys = { mixin, expiresAt: Date.now() + WBI_CACHE_TTL_MS };
  return mixin;
};

export const signWbiParams = async (params: URLSearchParams) => {
  const mixin = await getWbiMixinKey();
  params.set("wts", String(Math.floor(Date.now() / 1000)));

  const sortedKeys = [...params.keys()].sort();
  const sortedParams = new URLSearchParams();
  for (const key of sortedKeys) {
    const value = params.get(key);
    if (value !== null) {
      sortedParams.append(key, value);
    }
  }

  const query = sortedParams.toString();
  const w_rid = createHash("md5").update(`${query}${mixin}`).digest("hex");
  params.set("w_rid", w_rid);
  return params;
};
