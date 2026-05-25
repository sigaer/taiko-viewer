import type { H3Event } from "h3";
import { getCookie, getHeader } from "h3";

export const DEFAULT_VIEWER_LOCALE = "zh";
export const VIEWER_LOCALE_COOKIE_KEY = "viewer_locale";
export const VIEWER_LOCALE_TO_LANGUAGE: Record<string, string> = {
  zh: "zh-CN",
  ja: "ja-JP"
};

export const normalizeViewerLocale = (input?: string | null) => {
  const value = String(input || "").trim().toLowerCase();
  if (!value) return DEFAULT_VIEWER_LOCALE;
  if (value === "ja" || value.startsWith("ja-")) return "ja";
  if (value === "zh" || value.startsWith("zh-")) return "zh";
  return DEFAULT_VIEWER_LOCALE;
};

const resolveAcceptLanguage = (headerValue?: string | null) => {
  if (!headerValue) return DEFAULT_VIEWER_LOCALE;
  const first = headerValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0];
  return normalizeViewerLocale(first);
};

export const resolveViewerLocale = (event: H3Event) => {
  const explicitHeader = getHeader(event, "x-viewer-locale");
  if (explicitHeader) return normalizeViewerLocale(explicitHeader);

  const localeCookie = getCookie(event, VIEWER_LOCALE_COOKIE_KEY) || getCookie(event, "i18n_redirected");
  if (localeCookie) return normalizeViewerLocale(localeCookie);

  return resolveAcceptLanguage(getHeader(event, "accept-language"));
};

export const getViewerLanguageTag = (locale: string) =>
  VIEWER_LOCALE_TO_LANGUAGE[normalizeViewerLocale(locale)] || VIEWER_LOCALE_TO_LANGUAGE[DEFAULT_VIEWER_LOCALE];
