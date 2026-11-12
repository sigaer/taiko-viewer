import type { SongCatalogItem, V2ConstantsDifficulty, V2ConstantsItem } from "../../../types/content";

export type RemoteChart = {
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

type RemoteDifficultyMap = Record<string, RemoteChart>;

export type RemoteConstantsPayload = Record<string, RemoteDifficultyMap>;


export const DIFFICULTY_ORDER: V2ConstantsDifficulty[] = ["hard", "oni", "edit"];
const toPositiveInteger = (value: unknown) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
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
  localSongs: SongCatalogItem[],
  supplement?: { constants: unknown; provenance: unknown },
  catalogSupplement?: { constants: unknown; provenance: unknown }
): V2ConstantsItem[] => {
  if (!isRecord(payload)) {
    throw new Error("V2 constants payload is not a valid object");
  }
  const songMap = new Map(
    localSongs
      .map((song) => [toPositiveInteger(song.id), song] as const)
      .filter((entry): entry is readonly [number, SongCatalogItem] => entry[0] !== null)
  );
  const rows: V2ConstantsItem[] = [];

  const supplemental = isRecord(supplement?.constants) ? supplement.constants : {};
  const provenance = isRecord(supplement?.provenance) ? supplement.provenance : {};
  const catalogConstants = isRecord(catalogSupplement?.constants) ? catalogSupplement.constants : {};
  const catalogProvenance = isRecord(catalogSupplement?.provenance) ? catalogSupplement.provenance : {};
  const ids = new Set([...Object.keys(payload), ...Object.keys(supplemental), ...Object.keys(catalogConstants)]);
  for (const rawId of ids) {
    const difficultyMap = payload[rawId];
    const id = toPositiveInteger(rawId);
    const localSong = id === null ? null : songMap.get(id);
    if (!id || !localSong) {
      continue;
    }
    const songName = String(localSong.song_name || "").trim();
    if (songName.startsWith("【双打】")) {
      continue;
    }

    for (const difficulty of DIFFICULTY_ORDER) {
      let row: V2ConstantsItem | null = null;
      if (isRecord(difficultyMap)) {
        for (const course of [difficulty, `${difficulty}_single`, `${difficulty}_p1`]) {
          const chart = difficultyMap[course];
          if (isRecord(chart)) row = normalizeChart(id, songName, difficulty, chart);
          if (row) break;
        }
      }
      // Every supplement must prove its current single-player chart identity.
      // Existing remote and verified console values retain priority.
      for (const [values, sources] of [
        ...(Number(localSong.shelf_status) === 2 ? [[supplemental, provenance]] : []),
        [catalogConstants, catalogProvenance]
      ]) {
        if (row) break;
        const charts = values[rawId];
        const source = sources[rawId];
        const chart = isRecord(charts) ? charts[difficulty] : null;
        const identity = isRecord(source) && isRecord(source.charts) ? source.charts[difficulty] : null;
        if (isRecord(chart) && isRecord(identity)) {
          const candidate = normalizeChart(id, songName, difficulty, chart);
          const offset = DIFFICULTY_ORDER.indexOf(difficulty) + 2;
          const levelKey = `level_${offset + 1}` as "level_3" | "level_4" | "level_5";
          if (candidate && candidate.totalNotes === toPositiveInteger(localSong.max_combo?.[offset]) &&
              candidate.totalNotes === identity.catalogNotes &&
              toPositiveInteger(localSong[levelKey]) === identity.catalogLevel &&
              [difficulty, `${difficulty}_single`].includes(String(identity.course)) &&
              ["master", "unbranched"].includes(String(identity.branch))) row = candidate;
        }
      }
      if (row) rows.push(row);
    }
  }

  return rows;
};
