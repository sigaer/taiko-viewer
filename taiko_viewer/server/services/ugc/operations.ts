import type { UgcOperationsOverview, UgcOperationsWindow, ChartUgcModerationHistoryItem } from "../../../types/ugc";
import { getSongCatalog } from "../content/songs";
import { ensureUgcSchema, getUgcDb, type UgcDbRow } from "../../utils/ugc-db";

const WINDOW_INTERVALS: Record<Exclude<UgcOperationsWindow, "all">, string> = {
  "24h": "24 HOUR",
  "7d": "7 DAY",
  "30d": "30 DAY"
};

const normalizeWindow = (input: unknown): UgcOperationsWindow =>
  input === "24h" || input === "7d" || input === "30d" || input === "all" ? input : "all";

const periodClause = (window: UgcOperationsWindow, column = "created_at") =>
  window === "all" ? "" : ` AND ${column} >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${WINDOW_INTERVALS[window]})`;

const count = async (sql: string, params: any[] = []) => {
  const [rows] = await getUgcDb().execute<UgcDbRow<{ count: number }>[] >(sql, params);
  return Number(rows[0]?.count || 0);
};

const ratio = (value: number, total: number) => total ? Number((value / total).toFixed(4)) : 0;

export const resolveUgcOperatorAccountId = async (id: number, username: string) => {
  await ensureUgcSchema();
  const [rows] = await getUgcDb().execute<UgcDbRow<{ id: number }>[] >(
    "SELECT id FROM web_user_accounts WHERE id = ? OR username = ? ORDER BY id = ? DESC LIMIT 1",
    [id, username, id]
  );
  return rows[0] ? Number(rows[0].id) : null;
};

export const getUgcOperationsOverview = async (input?: unknown): Promise<UgcOperationsOverview> => {
  await ensureUgcSchema();
  const db = getUgcDb();
  const window = normalizeWindow(input);
  const [songs, chartCounts, difficultyVotes, tagVotes, activeTips, deletedTips, hiddenTips, helpful, pendingReports, resolvedReports,
    verifiedDifficulty, verifiedTags, verifiedTips, tagContributors, tipsWithHelpful, tipsWithReports, topCharts, difficultyDistribution, tagFrequency] = await Promise.all([
    getSongCatalog(),
    Promise.all([
      count("SELECT COUNT(*) AS count FROM ugc_charts WHERE status = 'active'"),
      count("SELECT COUNT(*) AS count FROM ugc_charts c WHERE EXISTS (SELECT 1 FROM chart_difficulty_votes v WHERE v.chart_id = c.chart_id) OR EXISTS (SELECT 1 FROM chart_tag_votes v WHERE v.chart_id = c.chart_id) OR EXISTS (SELECT 1 FROM chart_tips t WHERE t.chart_id = c.chart_id)"),
      count("SELECT COUNT(DISTINCT chart_id) AS count FROM chart_difficulty_votes"),
      count("SELECT COUNT(DISTINCT chart_id) AS count FROM chart_tag_votes"),
      count("SELECT COUNT(DISTINCT chart_id) AS count FROM chart_tips WHERE status = 'active'"),
    ]),
    count(`SELECT COUNT(*) AS count FROM chart_difficulty_votes WHERE 1=1${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tag_votes WHERE 1=1${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tips WHERE status = 'active'${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tips WHERE status = 'deleted'${periodClause(window, "updated_at")}`),
    count(`SELECT COUNT(*) AS count FROM chart_tips WHERE status = 'hidden'${periodClause(window, "updated_at")}`),
    count(`SELECT COUNT(*) AS count FROM chart_tip_helpful WHERE 1=1${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tip_reports WHERE status = 'pending'${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tip_reports WHERE status IN ('resolved', 'dismissed')${periodClause(window, "resolved_at")}`),
    count(`SELECT COUNT(*) AS count FROM chart_difficulty_votes WHERE verified_play = 1${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tag_votes WHERE verified_play = 1${periodClause(window)}`),
    count(`SELECT COUNT(*) AS count FROM chart_tips WHERE verified_play = 1${periodClause(window)}`),
    count(`SELECT COUNT(DISTINCT user_id) AS count FROM chart_tag_votes WHERE 1=1${periodClause(window)}`),
    count(`SELECT COUNT(DISTINCT tip_id) AS count FROM chart_tip_helpful${periodClause(window)}`),
    count(`SELECT COUNT(DISTINCT tip_id) AS count FROM chart_tip_reports${periodClause(window)}`),
    db.execute<UgcDbRow<{ chartId: number; songId: number; difficultyCode: number; contributions: number }>[] >(
      `SELECT c.chart_id AS chartId, c.song_id AS songId, c.difficulty_code AS difficultyCode,
          (SELECT COUNT(*) FROM chart_difficulty_votes d WHERE d.chart_id = c.chart_id) +
          (SELECT COUNT(*) FROM chart_tag_votes g WHERE g.chart_id = c.chart_id) +
          (SELECT COUNT(*) FROM chart_tips t WHERE t.chart_id = c.chart_id) AS contributions
       FROM ugc_charts c WHERE c.status = 'active'
       ORDER BY contributions DESC, c.chart_id ASC LIMIT 10`
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<{ value: number; count: number }>[] >(
      "SELECT value, COUNT(*) AS count FROM chart_difficulty_votes GROUP BY value ORDER BY value"
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<{ slug: string; labelKey: string; count: number }>[] >(
      `SELECT t.slug, t.label_key AS labelKey, COUNT(*) AS count
         FROM chart_tag_votes v INNER JOIN ugc_tags t ON t.tag_id = v.tag_id
        GROUP BY t.tag_id, t.slug, t.label_key ORDER BY count DESC, t.slug ASC LIMIT 20`
    ).then(([rows]) => rows)
  ]);
  const [active, withAnyUgc, withDifficultyVotes, withTags, withTips] = chartCounts;
  const songTitles = new Map(songs.map((song) => [Number(song.id), String(song.song_name || song.song_name_jp || `#${song.id}`)]));
  const periods = {} as UgcOperationsOverview["periods"];
  for (const key of ["24h", "7d", "30d", "all"] as const) {
    const [difficulty, tags, tips, helpfulCount, reports] = await Promise.all([
      count(`SELECT COUNT(*) AS count FROM chart_difficulty_votes WHERE 1=1${periodClause(key)}`),
      count(`SELECT COUNT(*) AS count FROM chart_tag_votes WHERE 1=1${periodClause(key)}`),
      count(`SELECT COUNT(*) AS count FROM chart_tips WHERE 1=1${periodClause(key)}`),
      count(`SELECT COUNT(*) AS count FROM chart_tip_helpful WHERE 1=1${periodClause(key)}`),
      count(`SELECT COUNT(*) AS count FROM chart_tip_reports WHERE 1=1${periodClause(key)}`)
    ]);
    periods[key] = { difficultyVotes: difficulty, tagVotes: tags, tips, helpful: helpfulCount, reports };
  }
  const totalTips = activeTips + deletedTips + hiddenTips;
  return {
    window,
    charts: { active, withAnyUgc, withDifficultyVotes, withTags, withTips },
    contributions: { difficultyVotes, tagVotes, activeTips, deletedTips, hiddenTips, helpful, reportsPending: pendingReports, reportsResolved: resolvedReports },
    quality: {
      verifiedDifficultyCount: verifiedDifficulty,
      verifiedDifficultyRatio: ratio(verifiedDifficulty, difficultyVotes),
      verifiedTagCount: verifiedTags,
      verifiedTagRatio: ratio(verifiedTags, tagVotes),
      verifiedTipCount: verifiedTips,
      verifiedTipRatio: ratio(verifiedTips, totalTips),
      averageTagsPerContributor: tagContributors ? Number((tagVotes / tagContributors).toFixed(2)) : 0,
      tipsWithHelpful,
      tipsWithReports
    },
    periods,
    topCharts: topCharts.map((row) => ({ chartId: String(row.chartId), songId: Number(row.songId), difficultyCode: Number(row.difficultyCode), songTitle: songTitles.get(Number(row.songId)) || `#${row.songId}`, contributions: Number(row.contributions) })),
    difficultyDistribution: difficultyDistribution.map((row) => ({ value: Number(row.value), count: Number(row.count) })),
    tagFrequency: tagFrequency.map((row) => ({ slug: String(row.slug), labelKey: String(row.labelKey), count: Number(row.count) }))
  };
};

export const listChartUgcModerationHistory = async (limitInput?: unknown): Promise<ChartUgcModerationHistoryItem[]> => {
  await ensureUgcSchema();
  const limit = Math.min(200, Math.max(1, Number(limitInput) || 100));
  const [rows] = await getUgcDb().execute<UgcDbRow<any>[]>(
    `SELECT log.id, log.target_type AS targetType, log.target_id AS targetId, log.action, log.reason,
            log.created_at AS createdAt, account.username AS operatorDisplayName
       FROM chart_ugc_moderation_logs log
       LEFT JOIN web_user_accounts account ON account.id = log.operator_user_id
      ORDER BY log.created_at DESC, log.id DESC LIMIT ${limit}`
  );
  return rows.map((row) => ({
    id: String(row.id), targetType: String(row.targetType), targetId: String(row.targetId), action: String(row.action),
    reason: row.reason == null ? null : String(row.reason), operatorDisplayName: String(row.operatorDisplayName || "已注销管理员"),
    operatorDeleted: !row.operatorDisplayName, createdAt: new Date(row.createdAt).toISOString()
  }));
};
