import type {
  ChartDifficultyVoteValue,
  ChartUgcSummary,
  ChartUgcTagDefinition,
  ViewerChartUgcTagSelection,
  ViewerChartUgcState
} from "../../../types/ugc";
import { aggregateDifficultyVotes, selectCommonTagAggregates } from "./aggregate";
import type { ResolvedUgcChart } from "./chart";
import {
  UGC_ANONYMOUS_AVATAR_URL,
  UGC_ANONYMOUS_DISPLAY_NAME,
  UGC_INITIAL_TIP_LIMIT
} from "./constants";
import { ensureUgcSchema, getUgcDb, type UgcDbRow } from "../../utils/ugc-db";

const toIso = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toISOString();
};

type DifficultyRow = { value: ChartDifficultyVoteValue; verifiedPlay: number };
type TagRow = { slug: string; labelKey: string; groupKey: string; count: number };
type TagDefinitionRow = ChartUgcTagDefinition & { status?: "active" | "deprecated" };
type TipRow = {
  tipId: number;
  body: string;
  helpfulCount: number;
  verifiedPlay: number;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
};

export const getPublicChartUgcSummary = async (chart: ResolvedUgcChart): Promise<ChartUgcSummary> => {
  await ensureUgcSchema();
  const db = getUgcDb();
  const [difficultyRows, tagRows, tagVoterRows, availableTagRows, tipRows] = await Promise.all([
    db.execute<UgcDbRow<DifficultyRow>[]>(
      "SELECT value, verified_play AS verifiedPlay FROM chart_difficulty_votes WHERE chart_id = ? ORDER BY user_id",
      [chart.chartId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TagRow>[]>(
      `SELECT t.slug, t.label_key AS labelKey, t.group_key AS groupKey, COUNT(*) AS count
         FROM chart_tag_votes v
         INNER JOIN ugc_tags t ON t.tag_id = v.tag_id
        WHERE v.chart_id = ? AND t.status = 'active'
        GROUP BY t.tag_id, t.slug, t.label_key, t.group_key
        ORDER BY count DESC, t.sort_order ASC, t.slug ASC`,
      [chart.chartId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<{ count: number }>[]>(
      `SELECT COUNT(DISTINCT vote.user_id) AS count
         FROM chart_tag_votes vote
         INNER JOIN ugc_tags tag ON tag.tag_id = vote.tag_id
        WHERE vote.chart_id = ? AND tag.status = 'active'`,
      [chart.chartId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TagDefinitionRow>[]>(
      `SELECT slug, label_key AS labelKey, group_key AS groupKey, sort_order AS sortOrder
         FROM ugc_tags
        WHERE status = 'active'
        ORDER BY sort_order, slug`
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TipRow>[]>(
      `SELECT tip.tip_id AS tipId, tip.body_text AS body, tip.verified_play AS verifiedPlay,
              tip.created_at AS createdAt, account.username AS displayName, account.avatar_url AS avatarUrl,
              COUNT(helpful.user_id) AS helpfulCount
         FROM chart_tips tip
         LEFT JOIN chart_tip_helpful helpful ON helpful.tip_id = tip.tip_id
         LEFT JOIN web_user_accounts account ON account.id = tip.author_user_id
        WHERE tip.chart_id = ? AND tip.status = 'active'
        GROUP BY tip.tip_id, tip.body_text, tip.verified_play, tip.created_at, account.username, account.avatar_url
        ORDER BY helpfulCount DESC, tip.created_at DESC, tip.tip_id DESC
        LIMIT ${UGC_INITIAL_TIP_LIMIT}`,
      [chart.chartId]
    ).then(([rows]) => rows)
  ]);

  return {
    chart: { chartId: String(chart.chartId), songId: chart.songId, difficultyCode: chart.difficultyCode },
    difficulty: aggregateDifficultyVotes(
      difficultyRows.map((row) => ({ value: Number(row.value) as ChartDifficultyVoteValue, verifiedPlay: Boolean(row.verifiedPlay) }))
    ),
    tags: selectCommonTagAggregates(
      tagRows.map((row) => ({ slug: String(row.slug), labelKey: String(row.labelKey), groupKey: String(row.groupKey), count: Number(row.count) })),
      Number(tagVoterRows[0]?.count || 0)
    ),
    availableTags: availableTagRows.map((row) => ({
      slug: String(row.slug),
      labelKey: String(row.labelKey),
      groupKey: String(row.groupKey),
      sortOrder: Number(row.sortOrder)
    })),
    tips: tipRows.map((row) => ({
      tipId: String(row.tipId),
      body: String(row.body),
      helpfulCount: Number(row.helpfulCount),
      verifiedPlay: Boolean(row.verifiedPlay),
      author: {
        displayName: String(row.displayName || UGC_ANONYMOUS_DISPLAY_NAME),
        avatarUrl: String(row.avatarUrl || UGC_ANONYMOUS_AVATAR_URL),
        isDeleted: !row.displayName
      },
      createdAt: toIso(row.createdAt)
    }))
  };
};

type ViewerTipRow = { tipId: number; body: string; status: "active" | "hidden" | "deleted" };

export const getViewerChartUgcState = async (chart: ResolvedUgcChart, userId: number): Promise<ViewerChartUgcState> => {
  await ensureUgcSchema();
  const db = getUgcDb();
  const [difficultyRows, tagRows, tipRows, helpfulRows] = await Promise.all([
    db.execute<UgcDbRow<{ value: ChartDifficultyVoteValue }>[]>(
      "SELECT value FROM chart_difficulty_votes WHERE chart_id = ? AND user_id = ? LIMIT 1",
      [chart.chartId, userId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TagDefinitionRow>[]>(
      `SELECT tag.slug, tag.label_key AS labelKey, tag.group_key AS groupKey,
              tag.sort_order AS sortOrder, tag.status
         FROM chart_tag_votes vote
         INNER JOIN ugc_tags tag ON tag.tag_id = vote.tag_id
        WHERE vote.chart_id = ? AND vote.user_id = ?
        ORDER BY tag.sort_order, tag.slug`,
      [chart.chartId, userId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<ViewerTipRow>[]>(
      `SELECT tip_id AS tipId, body_text AS body, status
         FROM chart_tips
        WHERE chart_id = ? AND author_user_id = ?
        LIMIT 1`,
      [chart.chartId, userId]
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<{ tipId: number }>[]>(
      `SELECT helpful.tip_id AS tipId
         FROM chart_tip_helpful helpful
         INNER JOIN chart_tips tip ON tip.tip_id = helpful.tip_id
        WHERE helpful.user_id = ? AND tip.chart_id = ? AND tip.status = 'active'
        ORDER BY helpful.tip_id`,
      [userId, chart.chartId]
    ).then(([rows]) => rows)
  ]);
  const tip = tipRows[0];
  return {
    chart: { chartId: String(chart.chartId), songId: chart.songId, difficultyCode: chart.difficultyCode },
    difficultyVote: difficultyRows[0] ? Number(difficultyRows[0].value) as ChartDifficultyVoteValue : null,
    tagSlugs: tagRows.map((row) => String(row.slug)),
    tagSelections: tagRows.map((row) => ({
      slug: String(row.slug),
      labelKey: String(row.labelKey),
      groupKey: String(row.groupKey),
      sortOrder: Number(row.sortOrder),
      status: String(row.status) as ViewerChartUgcTagSelection["status"]
    })),
    tip: tip ? { tipId: String(tip.tipId), body: String(tip.body), status: tip.status } : null,
    helpfulTipIds: helpfulRows.map((row) => String(row.tipId))
  };
};
