import {
  ALLOWED_IMAGE_HOST_SUFFIXES,
  BILIBILI_USER_AGENT,
  IMAGE_CACHE_TTL_MS,
  MAX_IMAGE_SIZE_BYTES,
  MAX_REDIRECT_HOPS
} from "./constants";
import { getCachedImage, setCachedImage } from "./cache";
import { bilibiliFetch } from "./fetch";

const isAllowedImageHost = (host: string) => {
  const normalized = host.toLowerCase();
  return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => {
    const base = suffix.slice(1);
    return normalized === base || normalized.endsWith(suffix);
  });
};

export const normalizeBilibiliImageUrl = (rawUrl: string) => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: "empty url" });
  }

  const parsed = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
  if (parsed.protocol === "http:") {
    parsed.protocol = "https:";
  }
  if (parsed.protocol !== "https:") {
    throw createError({ statusCode: 400, statusMessage: "URL is not allowed" });
  }
  if (parsed.username || parsed.password) {
    throw createError({ statusCode: 400, statusMessage: "URL is not allowed" });
  }
  const port = parsed.port;
  if (port && port !== "443") {
    throw createError({ statusCode: 400, statusMessage: "URL is not allowed" });
  }
  if (!isAllowedImageHost(parsed.hostname)) {
    throw createError({ statusCode: 400, statusMessage: "URL is not allowed" });
  }

  return parsed.toString();
};

const fetchImageWithRedirects = async (imageUrl: string) => {
  let currentUrl = imageUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const response = await bilibiliFetch(currentUrl, {
      headers: {
        "User-Agent": BILIBILI_USER_AGENT,
        Referer: "https://www.bilibili.com/"
      },
      redirect: "manual"
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw createError({ statusCode: 502, statusMessage: "Failed to fetch image" });
      }
      const nextUrl = new URL(location, currentUrl).toString();
      normalizeBilibiliImageUrl(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw createError({ statusCode: response.status, statusMessage: "Failed to fetch image" });
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_SIZE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: "Image too large" });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: "Image too large" });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    return { data: buffer, contentType };
  }

  throw createError({ statusCode: 502, statusMessage: "too many redirects" });
};

export const proxyBilibiliImage = async (rawUrl: string) => {
  const normalizedUrl = normalizeBilibiliImageUrl(rawUrl);
  const cached = getCachedImage(normalizedUrl);
  if (cached) {
    return cached;
  }

  const result = await fetchImageWithRedirects(normalizedUrl);
  setCachedImage(normalizedUrl, result, IMAGE_CACHE_TTL_MS);
  return result;
};
