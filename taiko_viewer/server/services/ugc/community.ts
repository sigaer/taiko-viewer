import type {
  ChartDifficultyVoteValue,
  CommunityChartActivity,
  CommunityChartActivityPayload
} from "../../../types/ugc";
import { aggregateDifficultyVotes, selectCommonTagAggregates } from "./aggregate";
import { ensureUgcSchema, getUgcDb, type UgcDbRow } from "../../utils/ugc-db";
import { getSongCatalog } from "../content/songs";
import { getSongCoverUrl } from "../content/covers";

type CandidateRow = {
  chartId: number;
  songId: number;
  difficultyCode: number;
  activityAt: Date | string | null;
  participantCount: number;
};
type DifficultyRow = { chartId: number; value: ChartDifficultyVoteValue; verifiedPlay: number };
type TagRow = { chartId: number; slug: string; labelKey: string; groupKey: string; count: number; voters: number };
type TipRow = { chartId: number; body: string; helpfulCount: number; createdAt: Date | string };

const toIsoOrNull = (value: Date | string | null | undefined) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const getCommunityChartActivity = async (limitInput = 8): Promise<CommunityChartActivityPayload> => {
  await ensureUgcSchema();
  const limit = Math.min(10, Math.max(1, Math.trunc(Number(limitInput) || 8)));
  const db = getUgcDb();
  const [candidateRows] = await db.execute<UgcDbRow<CandidateRow>[]>(
    `SELECT c.chart_id AS chartId, c.song_id AS songId, c.difficulty_code AS difficultyCode,
            MAX(activity.activity_at) AS activityAt,
            COUNT(DISTINCT activity.user_id) AS participantCount
       FROM ugc_charts c
       INNER JOIN (
         SELECT chart_id, user_id, created_at AS activity_at FROM chart_difficulty_votes
         UNION ALL
         SELECT chart_id, user_id, created_at AS activity_at FROM chart_tag_votes
         UNION ALL
         SELECT chart_id, author_user_id AS user_id, created_at AS activity_at
           FROM chart_tips WHERE status = 'active' AND author_user_id IS NOT NULL
       ) activity ON activity.chart_id = c.chart_id
      WHERE c.status = 'active'
      GROUP BY c.chart_id, c.song_id, c.difficulty_code
      ORDER BY activityAt DESC, c.chart_id DESC
      LIMIT 40`
  );
  if (!candidateRows.length) return { items: [] };

  const chartIds = candidateRows.map((row) => Number(row.chartId));
  const placeholders = chartIds.map(() => "?").join(", ");
  const [difficultyRows, tagRows, tipRows, songs] = await Promise.all([
    db.execute<UgcDbRow<DifficultyRow>[]>(
      `SELECT chart_id AS chartId, value, verified_play AS verifiedPlay
         FROM chart_difficulty_votes WHERE chart_id IN (${placeholders})`, chartIds
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TagRow>[]>(
      `SELECT v.chart_id AS chartId, t.slug, t.label_key AS labelKey, t.group_key AS groupKey,
              COUNT(*) AS count, COUNT(DISTINCT v.user_id) AS voters
         FROM chart_tag_votes v INNER JOIN ugc_tags t ON t.tag_id = v.tag_id AND t.status = 'active'
        WHERE v.chart_id IN (${placeholders})
        GROUP BY v.chart_id, t.tag_id, t.slug, t.label_key, t.group_key`, chartIds
    ).then(([rows]) => rows),
    db.execute<UgcDbRow<TipRow>[]>(
      `SELECT tip.chart_id AS chartId, tip.body_text AS body, tip.created_at AS createdAt,
              COUNT(helpful.user_id) AS helpfulCount
         FROM chart_tips tip LEFT JOIN chart_tip_helpful helpful ON helpful.tip_id = tip.tip_id
        WHERE tip.chart_id IN (${placeholders}) AND tip.status = 'active'
        GROUP BY tip.tip_id, tip.chart_id, tip.body_text, tip.created_at
        ORDER BY helpfulCount DESC, tip.created_at DESC, tip.tip_id DESC`, chartIds
    ).then(([rows]) => rows),
    getSongCatalog()
  ]);

  const difficultyByChart = new Map<number, DifficultyRow[]>();
  for (const row of difficultyRows) {
    const bucket = difficultyByChart.get(Number(row.chartId)) || [];
    bucket.push(row);
    difficultyByChart.set(Number(row.chartId), bucket);
  }
  const tagsByChart = new Map<number, TagRow[]>();
  for (const row of tagRows) {
    const bucket = tagsByChart.get(Number(row.chartId)) || [];
    bucket.push(row);
    tagsByChart.set(Number(row.chartId), bucket);
  }
  const tipByChart = new Map<number, TipRow>();
  for (const row of tipRows) if (!tipByChart.has(Number(row.chartId))) tipByChart.set(Number(row.chartId), row);
  const songMap = new Map(songs.map((song) => [Number(song.id), song]));

  const items = candidateRows.map((row): CommunityChartActivity | null => {
    const chartId = Number(row.chartId);
    const songId = Number(row.songId);
    const difficulty = Number(row.difficultyCode) as CommunityChartActivity["difficulty"];
    const song = songMap.get(songId);
    if (!song) return null;
    const votes = difficultyByChart.get(chartId) || [];
    const aggregate = aggregateDifficultyVotes(votes.map((vote) => ({ value: Number(vote.value) as ChartDifficultyVoteValue, verifiedPlay: Boolean(vote.verifiedPlay) })));
    const commonTags = selectCommonTagAggregates(
      (tagsByChart.get(chartId) || []).map((tag) => ({ slug: String(tag.slug), labelKey: String(tag.labelKey), groupKey: String(tag.groupKey), count: Number(tag.count) })),
      Math.max(...(tagsByChart.get(chartId) || []).map((tag) => Number(tag.voters)), 0)
    ).slice(0, 3);
    const tip = tipByChart.get(chartId);
    const levelValue = song[`level_${difficulty}` as keyof typeof song];
    const levelNumber = Number(levelValue);
    return {
      chartId: String(chartId), songId, difficulty,
      songTitle: String(song.song_name || song.song_name_jp || `#${songId}`),
      songTitleJp: String(song.song_name_jp || ""), cover: getSongCoverUrl(songId),
      level: Number.isFinite(levelNumber) && levelNumber > 0 ? Math.trunc(levelNumber) : null,
      difficultySummary: votes.length ? aggregate.summary : null,
      participantCount: Number(row.participantCount || 0),
      tags: commonTags.map((tag) => ({ slug: tag.slug, labelKey: tag.labelKey, count: tag.count })),
      tipPreview: tip ? { body: String(tip.body), helpfulCount: Number(tip.helpfulCount || 0) } : null,
      activityAt: toIsoOrNull(row.activityAt),
      href: `/songs/${songId}?difficulty=${difficulty}#chart-ugc`
    };
  }).filter((item): item is CommunityChartActivity => Boolean(item));

  const seen = new Set<string>();
  return { items: items.filter((item) => !seen.has(item.chartId) && seen.add(item.chartId)).slice(0, limit) };
};
