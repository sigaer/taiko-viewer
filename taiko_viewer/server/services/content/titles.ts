import type { TitleCatalogItem, TitlesPagePayload } from "~/types/content";

type RemoteTitle = Partial<TitleCatalogItem> & {
  song_ids?: unknown;
};

type RemoteTitlePage = {
  pageData?: RemoteTitle[];
  total?: number;
};

type RemoteResult<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

const TITLE_PAGE_SIZE = 500;
const MAX_TITLE_PAGES = 20;

const normalizeTitle = (raw: RemoteTitle): TitleCatalogItem | null => {
  const name = String(raw?.name || "").trim();
  if (!name) return null;

  const sourceSongIds = Array.isArray(raw.songIds)
    ? raw.songIds
    : Array.isArray(raw.song_ids)
      ? raw.song_ids
      : [];
  const songIds = Array.from(
    new Set(
      sourceSongIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );

  return {
    id: Number.isInteger(Number(raw.id)) ? Number(raw.id) : 0,
    name,
    rarity: Number.isInteger(Number(raw.rarity)) ? Number(raw.rarity) : 0,
    condition: String(raw.condition || "").trim(),
    songIds
  };
};

const getTitleApiBase = () => {
  const runtimeConfig = useRuntimeConfig();
  return String(
    runtimeConfig.taikoApiBase ||
      process.env.TAIKO_API_BASE ||
      runtimeConfig.taikoAdminApiBase ||
      process.env.TAIKO_ADMIN_API_BASE ||
      "http://8.138.33.103:4290"
  ).replace(/\/$/, "");
};

const fetchTitlePage = async (page: number) => {
  let result: RemoteResult<RemoteTitlePage>;
  try {
    result = await $fetch<RemoteResult<RemoteTitlePage>>("/taiko/title/page", {
      baseURL: getTitleApiBase(),
      query: { page, pageSize: TITLE_PAGE_SIZE },
      timeout: 10_000,
      retry: 1
    });
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      statusMessage: String(error?.data?.msg || error?.message || "称号接口请求失败")
    });
  }

  if (Number(result?.code) !== 0) {
    throw createError({
      statusCode: 502,
      statusMessage: String(result?.msg || "称号接口返回异常")
    });
  }
  return result.data || {};
};

export const getTitlesPageContent = async (): Promise<TitlesPagePayload> => {
  const titles: TitleCatalogItem[] = [];
  let total = 0;

  for (let page = 1; page <= MAX_TITLE_PAGES; page += 1) {
    const pageData = await fetchTitlePage(page);
    const rows = Array.isArray(pageData.pageData) ? pageData.pageData : [];
    total = Math.max(Number(pageData.total) || 0, total);
    titles.push(...rows.map(normalizeTitle).filter((title): title is TitleCatalogItem => Boolean(title)));

    if (rows.length === 0 || titles.length >= total) break;
  }

  if (total > titles.length) {
    throw createError({
      statusCode: 502,
      statusMessage: `称号接口分页数据不完整：${titles.length}/${total}`
    });
  }

  return {
    titles,
    total: Math.max(total, titles.length)
  };
};
