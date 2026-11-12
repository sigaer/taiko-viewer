import type {
  V2ConstantsDifficulty,
  V2ConstantsItem,
  V2ConstantsPayload,
  V2ConstantsSortKey
} from "~/types/content";
import { getSongCatalog, resolveCatalogSongId } from "./songs";
import { getCatalogConstants } from "./catalogConstants";
import { readPersistentCache, writePersistentCache } from "./persistentCache";

import consoleSupplement from "~/assets/data/v2_console_constants.json";
import { buildV2ConstantsRows, DIFFICULTY_ORDER, isRecord, type RemoteConstantsPayload } from "./v2ConstantsModel";
export { buildV2ConstantsRows } from "./v2ConstantsModel";

type SourceSnapshot = {
  payload: RemoteConstantsPayload;
  fetchedAt: string;
  expiresAt: number;
};

export type V2ConstantsCsvDataset = {
  body: string;
  filename: string;
  generatedAt: string;
  fetchedAt: string;
  stale: boolean;
};

export type V2ConstantsQuery = {
  keyword?: unknown;
  difficulty?: unknown;
  page?: unknown;
  pageSize?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
};

const SOURCE_CACHE_TTL_MS = 60 * 60 * 1000;
const SOURCE_RETRY_DELAY_MS = 5 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 10 * 1000;
const SOURCE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const SOURCE_CACHE_KEY = "v2-constants";
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = new Set([25, 50, 100]);
const DIFFICULTY_RANK = new Map(DIFFICULTY_ORDER.map((difficulty, index) => [difficulty, index]));
const SORT_KEYS = new Set<V2ConstantsSortKey>([
  "id",
  "songName",
  "difficulty",
  "totalNotes",
  "subConstant1",
  "mainConstant",
  "subConstant2",
  "stamina",
  "handspeed",
  "burst",
  "complex",
  "rhythm"
]);

let sourceCache: SourceSnapshot | null = null;
let sourceRefreshPromise: Promise<SourceSnapshot> | null = null;
let sourceCacheLoadPromise: Promise<void> | null = null;
let sourceRetryAt = 0;

const fetchSourceSnapshot = async (): Promise<SourceSnapshot> => {
  const runtimeConfig = useRuntimeConfig();
  const sourceUrl = String(runtimeConfig.v2ConstantsUrl || "").trim();
  if (!sourceUrl) {
    throw new Error("V2 constants source URL is not configured");
  }
  const payload = await $fetch<RemoteConstantsPayload>(sourceUrl, {
    timeout: SOURCE_TIMEOUT_MS,
    retry: 0
  });
  if (!isRecord(payload) || !isRecord(payload[Object.keys(payload)[0]])) {
    throw new Error("V2 constants source returned an invalid payload");
  }
  const snapshot = {
    payload,
    fetchedAt: new Date().toISOString(),
    expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
  };
  await writePersistentCache(SOURCE_CACHE_KEY, snapshot, snapshot.fetchedAt);
  return snapshot;
};

const loadSourceCache = async () => {
  if (sourceCache || sourceCacheLoadPromise) return sourceCacheLoadPromise;
  sourceCacheLoadPromise = (async () => {
    const cached = await readPersistentCache<SourceSnapshot>(SOURCE_CACHE_KEY);
    if (!cached || !isRecord(cached.data?.payload)) return;
    const fetchedAt = Date.parse(cached.data.fetchedAt || cached.savedAt);
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > SOURCE_MAX_STALE_MS) return;
    sourceCache = {
      payload: cached.data.payload,
      fetchedAt: new Date(fetchedAt).toISOString(),
      expiresAt: fetchedAt + SOURCE_CACHE_TTL_MS
    };
  })();
  await sourceCacheLoadPromise;
};

const refreshSourceSnapshot = () => {
  sourceRefreshPromise ||= fetchSourceSnapshot()
    .then((snapshot) => {
      sourceCache = snapshot;
      sourceRetryAt = 0;
      return snapshot;
    })
    .finally(() => {
      sourceRefreshPromise = null;
    });
  return sourceRefreshPromise;
};

const getSourceSnapshot = async () => {
  await loadSourceCache();
  const now = Date.now();
  if (sourceCache && sourceCache.expiresAt > now) {
    return { snapshot: sourceCache, stale: false };
  }
  if (sourceCache) {
    if (sourceRetryAt <= now) {
      void refreshSourceSnapshot().catch(() => {
        sourceRetryAt = Date.now() + SOURCE_RETRY_DELAY_MS;
      });
    }
    return { snapshot: sourceCache, stale: true };
  }
  if (sourceRetryAt > now) {
    throw createError({ statusCode: 502, statusMessage: "V2 定数数据源暂不可用" });
  }

  try {
    const snapshot = await refreshSourceSnapshot();
    return { snapshot, stale: false };
  } catch (error) {
    sourceRetryAt = now + SOURCE_RETRY_DELAY_MS;
    throw createError({
      statusCode: 502,
      statusMessage: "V2 定数数据源暂不可用",
      cause: error
    });
  }
};

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getV2ConstantsRowsSnapshot = async () => {
  const [source, localSongs, catalogSupplement] = await Promise.all([
    getSourceSnapshot().catch(() => null),
    getSongCatalog(),
    getCatalogConstants()
  ]);
  return {
    rows: buildV2ConstantsRows(source?.snapshot.payload || {}, localSongs, consoleSupplement, catalogSupplement || undefined),
    generatedAt: source?.snapshot.fetchedAt || catalogSupplement?.generatedAt || consoleSupplement.generatedAt,
    fetchedAt: source?.snapshot.fetchedAt || "",
    stale: source?.stale ?? true
  };
};

export const getSongV2ConstantsPayload = async (songId: number) => {
  songId = await resolveCatalogSongId(songId);
  const snapshot = await getV2ConstantsRowsSnapshot();
  return { items: snapshot.rows.filter((row) => row.id === songId) };
};

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const getV2ConstantsCsvDataset = async (): Promise<V2ConstantsCsvDataset> => {
  const snapshot = await getV2ConstantsRowsSnapshot();
  const rows = [...snapshot.rows].sort((left, right) => {
    const idDiff = left.id - right.id;
    if (idDiff !== 0) {
      return idDiff;
    }
    return (
      Number(DIFFICULTY_RANK.get(left.difficulty) || 0) -
      Number(DIFFICULTY_RANK.get(right.difficulty) || 0)
    );
  });
  const header = [
    "id",
    "title",
    "difficulty",
    "totalNotes",
    "sub_constant_1",
    "main_constant",
    "sub_constant_2",
    "stamina",
    "handspeed",
    "burst",
    "complex",
    "rhythm"
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.songName,
      row.difficulty,
      row.totalNotes,
      row.subConstant1,
      row.mainConstant,
      row.subConstant2,
      row.stamina,
      row.handspeed,
      row.burst,
      row.complex,
      row.rhythm
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  return {
    body: [header.join(","), ...lines].join("\n") + "\n",
    filename: "constants_id_v2.csv",
    generatedAt: snapshot.generatedAt,
    fetchedAt: snapshot.fetchedAt,
    stale: snapshot.stale
  };
};

const compareRows = (
  left: V2ConstantsItem,
  right: V2ConstantsItem,
  sortBy: V2ConstantsSortKey,
  direction: number
) => {
  let primary = 0;
  if (sortBy === "songName") {
    primary = left.songName.localeCompare(right.songName, "zh-Hans-CN");
  } else if (sortBy === "difficulty") {
    primary =
      Number(DIFFICULTY_RANK.get(left.difficulty) || 0) -
      Number(DIFFICULTY_RANK.get(right.difficulty) || 0);
  } else {
    primary = Number(left[sortBy]) - Number(right[sortBy]);
  }
  if (primary !== 0) {
    return primary * direction;
  }
  const idDiff = left.id - right.id;
  if (idDiff !== 0) {
    return idDiff;
  }
  return (
    Number(DIFFICULTY_RANK.get(left.difficulty) || 0) -
    Number(DIFFICULTY_RANK.get(right.difficulty) || 0)
  );
};

export const getV2ConstantsPayload = async (
  query: V2ConstantsQuery = {}
): Promise<V2ConstantsPayload> => {
  const keyword = String(query.keyword || "").trim().toLowerCase();
  const difficultyRaw = String(query.difficulty || "").trim().toLowerCase();
  const difficulty = DIFFICULTY_ORDER.includes(difficultyRaw as V2ConstantsDifficulty)
    ? (difficultyRaw as V2ConstantsDifficulty)
    : null;
  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = PAGE_SIZE_OPTIONS.has(requestedPageSize) ? requestedPageSize : DEFAULT_PAGE_SIZE;
  const requestedSortKey = String(query.sortBy || "id") as V2ConstantsSortKey;
  const sortBy = SORT_KEYS.has(requestedSortKey) ? requestedSortKey : "id";
  const sortOrder = String(query.sortOrder || "asc").toLowerCase() === "desc" ? "desc" : "asc";
  const direction = sortOrder === "desc" ? -1 : 1;

  const snapshot = await getV2ConstantsRowsSnapshot();
  const rows = snapshot.rows;
  const filtered = rows.filter((row) => {
    if (difficulty && row.difficulty !== difficulty) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return String(row.id).includes(keyword) || row.songName.toLowerCase().includes(keyword);
  });
  filtered.sort((left, right) => compareRows(left, right, sortBy, direction));
  const start = (page - 1) * pageSize;

  return {
    total: filtered.length,
    page,
    pageSize,
    generatedAt: snapshot.generatedAt,
    fetchedAt: snapshot.fetchedAt,
    stale: snapshot.stale,
    items: filtered.slice(start, start + pageSize)
  };
};
