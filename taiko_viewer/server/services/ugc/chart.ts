import type { ChartDifficultyCode, ChartUgcStatus } from "../../../types/ugc";
import { isChartDifficultyCode } from "./constants";
import { ensureUgcSchema, getUgcDb, type UgcDbRow } from "../../utils/ugc-db";

export type ResolvedUgcChart = {
  chartId: number;
  songId: number;
  difficultyCode: ChartDifficultyCode;
  sourceKey: string;
  catalogRevision: string;
  status: ChartUgcStatus;
};

type ChartRow = {
  chartId: number;
  songId: number;
  difficultyCode: number;
  sourceKey: string;
  catalogRevision: string;
  status: ChartUgcStatus;
};

export const assertChartLookupInput = (songIdInput: unknown, difficultyInput: unknown) => {
  const songId = Number(songIdInput);
  const difficultyCode = Number(difficultyInput);
  if (!Number.isInteger(songId) || songId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  if (!isChartDifficultyCode(difficultyCode)) {
    throw createError({ statusCode: 400, statusMessage: "谱面难度无效" });
  }
  return { songId, difficultyCode };
};

export const resolveChart = async (
  songIdInput: unknown,
  difficultyInput: unknown,
  options: { allowInactive?: boolean } = {}
): Promise<ResolvedUgcChart> => {
  const { songId, difficultyCode } = assertChartLookupInput(songIdInput, difficultyInput);
  await ensureUgcSchema();
  const db = getUgcDb();
  const [rows] = await db.execute<UgcDbRow<ChartRow>[]>(
    `SELECT chart_id AS chartId, song_id AS songId, difficulty_code AS difficultyCode,
            source_key AS sourceKey, catalog_revision AS catalogRevision, status
       FROM ugc_charts
      WHERE song_id = ? AND difficulty_code = ?
      ORDER BY chart_id ASC
      LIMIT 1`,
    [songId, difficultyCode]
  );
  const row = rows[0];
  if (!row) throw createError({ statusCode: 404, statusMessage: "谱面不存在" });
  if (row.status !== "active" && !options.allowInactive) {
    throw createError({ statusCode: 410, statusMessage: "谱面当前不可用" });
  }
  return {
    chartId: Number(row.chartId),
    songId: Number(row.songId),
    difficultyCode: Number(row.difficultyCode) as ChartDifficultyCode,
    sourceKey: String(row.sourceKey),
    catalogRevision: String(row.catalogRevision),
    status: row.status
  };
};
