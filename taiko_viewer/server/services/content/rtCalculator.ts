import type { RtCalculatorPayload } from '../../../utils/rtCalculator';
import { buildV1RtCharts, type RatingConfig } from '../../../utils/rtCalculatorCatalog';
import { getSongCatalog } from './songs';
import { getSongV2ConstantsPayload } from './v2Constants';
import { getContentRuntimePaths, readCachedJsonFile } from './runtime';

let cache: { mtimeMs: number; data: RatingConfig } | null = null;

export async function getRtCalculatorPayload(songId: number): Promise<RtCalculatorPayload> {
  const songs = await getSongCatalog();
  const song = songs.find(row => Number(row.id) === songId);
  if (!song) throw createError({ statusCode: 404, statusMessage: '歌曲不存在' });
  const [rating, v2] = await Promise.all([
    readCachedJsonFile<RatingConfig>(cache, getContentRuntimePaths().ratingStructPath),
    getSongV2ConstantsPayload(songId).catch(() => null)
  ]);
  cache = rating.cache;
  return { song: { id: songId, title: song.song_name, titleJa: song.song_name_jp || song.song_name },
    v1: buildV1RtCharts(rating.data, songId), v2: v2?.items || [], v2Unavailable: v2 === null };
}
