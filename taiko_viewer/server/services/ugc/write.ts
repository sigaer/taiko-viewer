import type { PoolConnection } from "mysql2/promise";
import type { ViewerChartUgcState } from "../../../types/ugc";
import type { ResolvedUgcChart } from "./chart";
import { hasVerifiedPlayForChart } from "./verified-play";
import { getViewerChartUgcState } from "./read";
import { normalizeDifficultyVoteValue, normalizeUgcTagSlugs } from "./validation";
import { ensureUgcSchema, getUgcDb, type UgcDbRow } from "../../utils/ugc-db";

export const setChartDifficultyVote = async (
  userId: number,
  chart: ResolvedUgcChart,
  valueInput: unknown
): Promise<ViewerChartUgcState> => {
  const value = normalizeDifficultyVoteValue(valueInput);
  await ensureUgcSchema();
  const db = getUgcDb();
  if (value === null) {
    await db.execute("DELETE FROM chart_difficulty_votes WHERE chart_id = ? AND user_id = ?", [chart.chartId, userId]);
  } else {
    const verifiedPlay = await hasVerifiedPlayForChart(userId, chart);
    await db.execute(
      `INSERT INTO chart_difficulty_votes (chart_id, user_id, value, verified_play)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         value = VALUES(value),
         verified_play = VALUES(verified_play),
         updated_at = CURRENT_TIMESTAMP`,
      [chart.chartId, userId, value, verifiedPlay ? 1 : 0]
    );
  }
  return getViewerChartUgcState(chart, userId);
};

type TagDefinitionRow = {
  tagId: number;
  slug: string;
};

const lockAccountForTagReplacement = async (connection: PoolConnection, userId: number) => {
  const [rows] = await connection.execute<UgcDbRow<{ id: number }>[]>(
    "SELECT id FROM web_user_accounts WHERE id = ? FOR UPDATE",
    [userId]
  );
  if (!rows.length) throw createError({ statusCode: 401, statusMessage: "请先登录" });
};

export const replaceChartTags = async (
  userId: number,
  chart: ResolvedUgcChart,
  slugsInput: unknown
): Promise<ViewerChartUgcState> => {
  const slugs = normalizeUgcTagSlugs(slugsInput);
  await ensureUgcSchema();
  const verifiedPlay = await hasVerifiedPlayForChart(userId, chart);
  const connection = await getUgcDb().getConnection();
  try {
    await connection.beginTransaction();
    await lockAccountForTagReplacement(connection, userId);

    let tags: TagDefinitionRow[] = [];
    if (slugs.length) {
      const placeholders = slugs.map(() => "?").join(", ");
      const [rows] = await connection.execute<UgcDbRow<TagDefinitionRow>[]>(
        `SELECT tag_id AS tagId, slug
           FROM ugc_tags
          WHERE slug IN (${placeholders}) AND status = 'active'
          FOR SHARE`,
        slugs
      );
      tags = rows;
      if (tags.length !== slugs.length) {
        throw createError({ statusCode: 400, statusMessage: "包含不可用的谱面标签" });
      }
    }

    await connection.execute("DELETE FROM chart_tag_votes WHERE chart_id = ? AND user_id = ?", [chart.chartId, userId]);
    for (const tag of tags) {
      await connection.execute(
        `INSERT INTO chart_tag_votes (chart_id, tag_id, user_id, verified_play)
         VALUES (?, ?, ?, ?)`,
        [chart.chartId, Number(tag.tagId), userId, verifiedPlay ? 1 : 0]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getViewerChartUgcState(chart, userId);
};
