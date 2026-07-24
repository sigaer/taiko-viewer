import type {
  SongCatalogItem,
  V2ConstantsDifficulty,
  V2ConstantsItem,
  V2ConstantsPayload,
  V2ConstantsSortKey
} from "~/types/content";
import { getSongCatalog } from "./songs";

type RemoteChart = {
  course?: unknown;
  branchType?: unknown;
  totalNotes?: unknown;
  sub_constant_1?: unknown;
  main_constant?: unknown;
  sub_constant_2?: unknown;
  stamina?: unknown;
  handspeed?: unknown;
  burst?: unknown;
  complex?: unknown;
  rhythm?: unknown;
};

type RemoteSong = {
  charts?: unknown;
};

type RemoteConstantsPayload = {
  metadata?: {
    generated_at?: unknown;
  };
  songs?: unknown;
};

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
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = new Set([25, 50, 100]);
const ALLOWED_BRANCH_TYPES = new Set(["master", "unbranched"]);
const DIFFICULTY_ORDER: V2ConstantsDifficulty[] = ["hard", "oni", "edit"];
const DIFFICULTY_RANK = new Map(DIFFICULTY_ORDER.map((difficulty, index) => [difficulty, index]));
const COURSE_PRIORITY: Record<V2ConstantsDifficulty, string[]> = {
  hard: ["hard", "hard_single"],
  oni: ["oni", "oni_single"],
  edit: ["edit", "edit_single"]
};
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
let sourceRetryAt = 0;

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toFiniteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeChart = (
  id: number,
  songName: string,
  difficulty: V2ConstantsDifficulty,
  chart: RemoteChart
): V2ConstantsItem | null => {
  const totalNotes = toPositiveInteger(chart.totalNotes);
  const subConstant1 = toFiniteNumber(chart.sub_constant_1);
  const mainConstant = toFiniteNumber(chart.main_constant);
  const subConstant2 = toFiniteNumber(chart.sub_constant_2);
  const stamina = toFiniteNumber(chart.stamina);
  const handspeed = toFiniteNumber(chart.handspeed);
  const burst = toFiniteNumber(chart.burst);
  const complex = toFiniteNumber(chart.complex);
  const rhythm = toFiniteNumber(chart.rhythm);
  if (
    totalNotes === null ||
    subConstant1 === null ||
    mainConstant === null ||
    subConstant2 === null ||
    stamina === null ||
    handspeed === null ||
    burst === null ||
    complex === null ||
    rhythm === null
  ) {
    return null;
  }
  return {
    id,
    songName,
    difficulty,
    totalNotes,
    subConstant1,
    mainConstant,
    subConstant2,
    stamina,
    handspeed,
    burst,
    complex,
    rhythm
  };
};

export const buildV2ConstantsRows = (
  payload: RemoteConstantsPayload,
  localSongs: SongCatalogItem[]
): V2ConstantsItem[] => {
  if (!isRecord(payload.songs)) {
    throw new Error("V2 constants payload does not contain a songs object");
  }
  const songMap = new Map(
    localSongs
      .map((song) => [toPositiveInteger(song.id), song] as const)
      .filter((entry): entry is readonly [number, SongCatalogItem] => entry[0] !== null)
  );
  const rows: V2ConstantsItem[] = [];

  for (const [rawId, rawSong] of Object.entries(payload.songs)) {
    const id = toPositiveInteger(rawId);
    const localSong = id === null ? null : songMap.get(id);
    if (!id || !localSong || !isRecord(rawSong)) {
      continue;
    }
    const charts = Array.isArray((rawSong as RemoteSong).charts)
      ? ((rawSong as RemoteSong).charts as unknown[])
          .filter(isRecord)
          .map((chart) => chart as RemoteChart)
          .filter((chart) => ALLOWED_BRANCH_TYPES.has(String(chart.branchType || "")))
      : [];

    for (const difficulty of DIFFICULTY_ORDER) {
      const chart = COURSE_PRIORITY[difficulty]
        .map((course) => charts.find((item) => item.course === course))
        .find(Boolean);
      if (!chart) {
        continue;
      }
      const row = normalizeChart(id, String(localSong.song_name || "").trim(), difficulty, chart);
      if (row) {
        rows.push(row);
      }
    }
  }

  return rows;
};

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
  if (!isRecord(payload) || !isRecord(payload.songs)) {
    throw new Error("V2 constants source returned an invalid payload");
  }
  return {
    payload,
    fetchedAt: new Date().toISOString(),
    expiresAt: Date.now() + SOURCE_CACHE_TTL_MS
  };
};

const getSourceSnapshot = async () => {
  const now = Date.now();
  if (sourceCache && sourceCache.expiresAt > now) {
    return { snapshot: sourceCache, stale: false };
  }
  if (sourceCache && sourceRetryAt > now) {
    return { snapshot: sourceCache, stale: true };
  }

  try {
    sourceRefreshPromise ||= fetchSourceSnapshot();
    const snapshot = await sourceRefreshPromise;
    sourceCache = snapshot;
    sourceRetryAt = 0;
    return { snapshot, stale: false };
  } catch (error) {
    if (sourceCache) {
      sourceRetryAt = now + SOURCE_RETRY_DELAY_MS;
      return { snapshot: sourceCache, stale: true };
    }
    throw createError({
      statusCode: 502,
      statusMessage: "V2 定数数据源暂不可用",
      cause: error
    });
  } finally {
    sourceRefreshPromise = null;
  }
};

const parsePositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getV2ConstantsRowsSnapshot = async () => {
  const [{ snapshot, stale }, localSongs] = await Promise.all([
    getSourceSnapshot(),
    getSongCatalog()
  ]);
  return {
    rows: buildV2ConstantsRows(snapshot.payload, localSongs),
    generatedAt: String(snapshot.payload.metadata?.generated_at || ""),
    fetchedAt: snapshot.fetchedAt,
    stale
  };
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
