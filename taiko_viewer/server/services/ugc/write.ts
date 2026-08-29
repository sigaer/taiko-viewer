import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import type { ViewerChartUgcState } from "../../../types/ugc";
import type { ResolvedUgcChart } from "./chart";
import { hasVerifiedPlayForChart } from "./verified-play";
import { getViewerChartUgcState } from "./read";
import { normalizeDifficultyVoteValue, normalizeModerationReason, normalizeReportReason, normalizeTipBody, normalizeUgcTagSlugs } from "./validation";
import type { ViewerTipStatus } from "../../../types/ugc";
import { UGC_ANONYMOUS_AVATAR_URL, UGC_ANONYMOUS_DISPLAY_NAME } from "./constants";
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

const lockTip = async (connection: PoolConnection, tipId: number) => {
  const [rows] = await connection.execute<UgcDbRow<{ tipId: number; chartId: number; authorUserId: number | null; body: string; status: ViewerTipStatus }>[]>(
    "SELECT tip_id AS tipId, chart_id AS chartId, author_user_id AS authorUserId, body_text AS body, status FROM chart_tips WHERE tip_id = ? FOR UPDATE", [tipId]
  );
  const tip = rows[0];
  if (!tip) throw createError({ statusCode: 404, statusMessage: "提示不存在" });
  return tip;
};

export const upsertChartTip = async (userId: number, chart: ResolvedUgcChart, bodyInput: unknown) => {
  const body = normalizeTipBody(bodyInput);
  await ensureUgcSchema();
  const verifiedPlay = await hasVerifiedPlayForChart(userId, chart);
  const connection = await getUgcDb().getConnection();
  try {
    await connection.beginTransaction();
    await lockAccountForTagReplacement(connection, userId);
    const [rows] = await connection.execute<UgcDbRow<{ tipId: number; status: ViewerTipStatus }>[]>(
      "SELECT tip_id AS tipId, status FROM chart_tips WHERE chart_id = ? AND author_user_id = ? FOR UPDATE", [chart.chartId, userId]
    );
    const existing = rows[0];
    if (!existing) {
      const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO chart_tips (chart_id, author_user_id, body_text, status, verified_play) VALUES (?, ?, ?, 'active', ?)",
        [chart.chartId, userId, body, verifiedPlay ? 1 : 0]
      );
      await connection.commit();
      return { tipId: String(result.insertId), body, status: "active" as const };
    }
    if (existing.status === "hidden") throw createError({ statusCode: 403, statusMessage: "该提示当前不可编辑" });
    await connection.execute(
      "UPDATE chart_tips SET body_text = ?, status = 'active', verified_play = ?, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE tip_id = ?",
      [body, verifiedPlay ? 1 : 0, existing.tipId]
    );
    await connection.commit();
    return { tipId: String(existing.tipId), body, status: "active" as const };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const deleteChartTip = async (userId: number, chart: ResolvedUgcChart) => {
  await ensureUgcSchema();
  const connection = await getUgcDb().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<UgcDbRow<{ tipId: number; status: ViewerTipStatus }>[]>(
      "SELECT tip_id AS tipId, status FROM chart_tips WHERE chart_id = ? AND author_user_id = ? FOR UPDATE", [chart.chartId, userId]
    );
    const tip = rows[0];
    if (!tip) throw createError({ statusCode: 404, statusMessage: "提示不存在" });
    if (tip.status === "hidden") throw createError({ statusCode: 403, statusMessage: "该提示当前不可删除" });
    await connection.execute("UPDATE chart_tips SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tip_id = ?", [tip.tipId]);
    await connection.commit();
    return { tipId: String(tip.tipId), status: "deleted" as const };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const setTipHelpful = async (userId: number, tipIdInput: unknown, enabledInput: unknown) => {
  const tipId = Number(tipIdInput);
  if (!Number.isSafeInteger(tipId) || tipId <= 0 || typeof enabledInput !== "boolean") {
    throw createError({ statusCode: 400, statusMessage: "有帮助操作无效" });
  }
  await ensureUgcSchema();
  const db = getUgcDb();
  const [rows] = await db.execute<UgcDbRow<{ chartId: number; authorUserId: number | null; status: ViewerTipStatus }>[]>(
    "SELECT chart_id AS chartId, author_user_id AS authorUserId, status FROM chart_tips WHERE tip_id = ? LIMIT 1", [tipId]
  );
  const tip = rows[0];
  if (!tip || tip.status === "deleted") throw createError({ statusCode: 404, statusMessage: "提示不存在" });
  if (tip.status === "hidden") throw createError({ statusCode: 409, statusMessage: "该提示当前不可操作" });
  if (tip.authorUserId === userId) throw createError({ statusCode: 403, statusMessage: "不能给自己的提示标记有帮助" });
  if (enabledInput) {
    await db.execute("INSERT IGNORE INTO chart_tip_helpful (tip_id, user_id) VALUES (?, ?)", [tipId, userId]);
  } else {
    await db.execute("DELETE FROM chart_tip_helpful WHERE tip_id = ? AND user_id = ?", [tipId, userId]);
  }
  const [countRows] = await db.execute<UgcDbRow<{ count: number }>[]>("SELECT COUNT(*) AS count FROM chart_tip_helpful WHERE tip_id = ?", [tipId]);
  return { tipId: String(tipId), enabled: Boolean(enabledInput), helpfulCount: Number(countRows[0]?.count || 0) };
};

export const reportChartTip = async (userId: number, tipIdInput: unknown, reasonInput: unknown) => {
  const tipId = Number(tipIdInput);
  if (!Number.isSafeInteger(tipId) || tipId <= 0) throw createError({ statusCode: 400, statusMessage: "提示 ID 无效" });
  const reason = normalizeReportReason(reasonInput);
  await ensureUgcSchema();
  const connection = await getUgcDb().getConnection();
  try {
    await connection.beginTransaction();
    const tip = await lockTip(connection, tipId);
    if (tip.status === "deleted") throw createError({ statusCode: 404, statusMessage: "提示不存在" });
    if (tip.status === "hidden") throw createError({ statusCode: 409, statusMessage: "该提示当前不可举报" });
    const [insertResult] = await connection.execute<ResultSetHeader>("INSERT IGNORE INTO chart_tip_reports (tip_id, reporter_user_id, reason) VALUES (?, ?, ?)", [tipId, userId, reason]);
    const [rows] = await connection.execute<UgcDbRow<{ reportId: number; status: string }>[]>("SELECT report_id AS reportId, status FROM chart_tip_reports WHERE tip_id = ? AND reporter_user_id = ? LIMIT 1", [tipId, userId]);
    await connection.commit();
    return { reportId: String(rows[0]?.reportId || ""), status: String(rows[0]?.status || "pending"), duplicate: Number(insertResult.affectedRows || 0) === 0 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const moderateChartTip = async (operatorUserId: number, tipIdInput: unknown, actionInput: unknown, reasonInput: unknown) => {
  const tipId = Number(tipIdInput);
  const action = actionInput === "hide" || actionInput === "restore" ? actionInput : null;
  if (!Number.isSafeInteger(tipId) || tipId <= 0 || !action) throw createError({ statusCode: 400, statusMessage: "管理操作无效" });
  const reason = normalizeModerationReason(reasonInput);
  await ensureUgcSchema();
  const connection = await getUgcDb().getConnection();
  try {
    await connection.beginTransaction();
    const tip = await lockTip(connection, tipId);
    if (action === "hide" && tip.status !== "active") throw createError({ statusCode: 409, statusMessage: "只有公开中的提示可以隐藏" });
    if (action === "restore" && tip.status !== "hidden") throw createError({ statusCode: 409, statusMessage: "只有已隐藏的提示可以恢复" });
    const nextStatus = action === "hide" ? "hidden" : "active";
    await connection.execute("UPDATE chart_tips SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tip_id = ?", [nextStatus, tipId]);
    if (action === "hide") {
      await connection.execute("UPDATE chart_tip_reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by_user_id = ? WHERE tip_id = ? AND status = 'pending'", [operatorUserId, tipId]);
    }
    await connection.execute("INSERT INTO chart_ugc_moderation_logs (target_type, target_id, operator_user_id, action, reason) VALUES ('tip', ?, ?, ?, ?)", [tipId, operatorUserId, action, reason]);
    await connection.commit();
    return { tipId: String(tipId), status: nextStatus as ViewerTipStatus, action };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const listChartTipReports = async () => {
  await ensureUgcSchema();
  const db = getUgcDb();
  const [rows] = await db.execute<UgcDbRow<any>[]>(
    "SELECT report.report_id AS reportId, report.reason, report.status AS reportStatus, report.created_at AS createdAt, tip.tip_id AS tipId, tip.body_text AS body, tip.status AS tipStatus, tip.verified_play AS verifiedPlay, tip.chart_id AS chartId, chart.song_id AS songId, chart.difficulty_code AS difficultyCode, account.username AS displayName, account.avatar_url AS avatarUrl, (SELECT COUNT(*) FROM chart_tip_reports r2 WHERE r2.tip_id = tip.tip_id) AS reportCount FROM chart_tip_reports report INNER JOIN chart_tips tip ON tip.tip_id = report.tip_id INNER JOIN ugc_charts chart ON chart.chart_id = tip.chart_id LEFT JOIN web_user_accounts account ON account.id = tip.author_user_id WHERE report.status = 'pending' ORDER BY report.created_at ASC, report.report_id ASC"
  );
  return rows.map((row) => ({
    reportId: String(row.reportId), reason: String(row.reason), status: String(row.reportStatus), createdAt: new Date(row.createdAt).toISOString(), reportCount: Number(row.reportCount || 0),
    tip: { tipId: String(row.tipId), body: String(row.body), status: row.tipStatus as ViewerTipStatus, author: { displayName: String(row.displayName || UGC_ANONYMOUS_DISPLAY_NAME), avatarUrl: String(row.avatarUrl || UGC_ANONYMOUS_AVATAR_URL), isDeleted: !row.displayName }, chart: { chartId: String(row.chartId), songId: Number(row.songId), difficultyCode: Number(row.difficultyCode) } }
  }));
};
