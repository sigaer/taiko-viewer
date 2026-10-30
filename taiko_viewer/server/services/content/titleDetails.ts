import { createError } from "h3";
import type { TitleCatalogItem, TitlesPagePayload } from "~/types/content";

type LocalTitle = Partial<TitleCatalogItem> & { song_ids?: unknown };
type LocalTitlePage = {
  code?: number;
  data?: { pageData?: LocalTitle[]; total?: number };
};

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

export const normalizeTitleCondition = (value: unknown): string => {
  const text = String(value || "").trim();
  return /^[?？\s]*$/u.test(text) ? "" : text;
};

const normalizeSongIds = (value: unknown): number[] =>
  Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    : [];

// IDs in tb_title and Wahlap refer to different catalogs. The plate identifies
// distinct clear/FC/AP and omote/ura variants that can share the same name.
const titleKey = (title: Pick<TitleCatalogItem, "name" | "rarity">) =>
  JSON.stringify([title.name.normalize("NFKC").replace(/\s+/gu, " ").trim(), title.rarity]);

export const mergeOfficialTitleDetails = (
  official: TitlesPagePayload,
  local: TitleCatalogItem[]
): TitlesPagePayload => {
  const byTitle = new Map(local.map((title) => [titleKey(title), title]));
  const titles = official.titles.map((title) => {
    const details = byTitle.get(titleKey(title));
    const localSongIds = normalizeSongIds(details?.songIds);
    return {
      ...title,
      condition: normalizeTitleCondition(details?.condition) || normalizeTitleCondition(title.condition),
      songIds: localSongIds.length ? localSongIds : normalizeSongIds(title.songIds)
    };
  });
  return { titles, total: titles.length };
};

export const getLocalTitleDetails = async (): Promise<TitleCatalogItem[]> => {
  const config = useRuntimeConfig();
  const baseURL = String(
    config.taikoApiBase ||
      process.env.TAIKO_API_BASE ||
      config.taikoAdminApiBase ||
      process.env.TAIKO_ADMIN_API_BASE ||
      "http://8.138.33.103:4290"
  ).replace(/\/$/, "");
  const titles: TitleCatalogItem[] = [];
  let total: number | undefined;
  const seenIds = new Set<number>();

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await $fetch<LocalTitlePage>("/taiko/title/page", {
        baseURL,
        query: { page, pageSize: PAGE_SIZE },
        timeout: 10_000,
        retry: 1
      });
      const rows = result?.data?.pageData;
      const reportedTotal = Number(result?.data?.total);
      if (
        Number(result?.code) !== 0 ||
        !Array.isArray(rows) ||
        !Number.isInteger(reportedTotal) ||
        reportedTotal < 0 ||
        (total !== undefined && reportedTotal !== total)
      ) throw new Error("Invalid local title page");
      total = reportedTotal;
      for (const row of rows) {
        const id = Number(row.id);
        const rarity = Number(row.rarity);
        const name = String(row.name || "").trim();
        if (!name || !Number.isInteger(id) || !Number.isInteger(rarity) || seenIds.has(id)) {
          throw new Error("Invalid or repeated local title");
        }
        seenIds.add(id);
        titles.push({
          id, name, rarity,
          condition: normalizeTitleCondition(row.condition),
          songIds: normalizeSongIds(Array.isArray(row.songIds) ? row.songIds : row.song_ids)
        });
      }
      if (titles.length === total) return titles;
      if (!rows.length || titles.length > total) break;
    }
    throw new Error("Incomplete local title catalog");
  } catch {
    // An unavailable local source is not evidence that its details are absent.
    throw createError({ statusCode: 503, statusMessage: "称号详情暂时无法加载" });
  }
};
