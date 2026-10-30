import { createError } from "h3";
import type { TitlesPagePayload } from "~/types/content";

// The center owns upstream authentication, full pagination and last-good cache.
// Both this page and Bot queries consume that same official catalog.
export const getTitlesPageContent = async (): Promise<TitlesPagePayload> => {
  const config = useRuntimeConfig();
  const baseURL = String(
    config.taikoTitleApiBase || process.env.TAIKO_TITLE_API_BASE || "http://127.0.0.1:9999"
  ).replace(/\/$/, "");
  try {
    const content = await $fetch<TitlesPagePayload>("/api/titles", {
      baseURL,
      timeout: 30_000,
      retry: 0
    });
    if (!Array.isArray(content?.titles) || content.total !== content.titles.length) {
      throw new Error("Invalid official title catalog");
    }
    return content;
  } catch {
    throw createError({ statusCode: 503, statusMessage: "称号列表暂时无法加载" });
  }
};
