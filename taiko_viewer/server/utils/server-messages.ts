import type { H3Event } from "h3";
import zh from "~/locales/zh.json";
import ja from "~/locales/ja.json";
import { DEFAULT_VIEWER_LOCALE, normalizeViewerLocale, resolveViewerLocale } from "./locale";

const MESSAGE_TABLE = {
  zh,
  ja
} as const;

const lookupMessage = (locale: string, key: string) => {
  const normalizedLocale = normalizeViewerLocale(locale);
  const table = MESSAGE_TABLE[normalizedLocale as keyof typeof MESSAGE_TABLE] || MESSAGE_TABLE[DEFAULT_VIEWER_LOCALE];
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, table);
};

const applyNamedParams = (message: string, named?: Record<string, unknown>) => {
  if (!named) return message;
  return message.replace(/\{(\w+)\}/g, (_, key) => String(named[key] ?? `{${key}}`));
};

export const translateServerMessage = (
  locale: string,
  key: string,
  named?: Record<string, unknown>,
  fallback?: string
) => {
  const resolved = lookupMessage(locale, key);
  if (typeof resolved === "string") {
    return applyNamedParams(resolved, named);
  }
  return fallback || key;
};

export const createServerMessageTranslator = (event: H3Event) => {
  const locale = resolveViewerLocale(event);
  return {
    locale,
    t: (key: string, named?: Record<string, unknown>, fallback?: string) =>
      translateServerMessage(locale, key, named, fallback)
  };
};
