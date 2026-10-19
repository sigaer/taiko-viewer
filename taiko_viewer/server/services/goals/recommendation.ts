import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createError } from 'h3';
import type { PoolConnection } from 'mysql2/promise';
import { getAccountDb } from '../../utils/account-db';
import { getRuntimePaths } from '../../internal/account/shared';
import { withPersonalScoreRead } from '../account/personal';
import { getSongCatalog } from '../content';
import { getGrowthModelRevision } from '../growth-history/model-revision';
import { readGoalSnapshot } from './snapshot';
import { readActiveGoal } from './store';
import { goalBaseline, goalChartAvailable, goalOptions } from '../../../utils/playerGoal';

// Short-lived intent, not a cache or a credential. A restart requires a fresh
// recommendation. The owner, binding, source, inputs and ordered position are signed.
const key = randomBytes(32);
type Receipt = { userId: number; profileId: string; account: string; source: string; songId: number; difficultyType: number; basis: string; rank: number; revision: string; inputs: string; generatedAt: string; expires: number };
export const recommendationInputRevision = async (catalog: unknown, modelRevision?: string) => {
  const hash = createHash('sha256').update(JSON.stringify(catalog)).update(modelRevision || await getGrowthModelRevision());
  // Include the center's raw implementation/availability input as well as the
  // existing model identity. Re-read bytes under SQL locks without launching Python.
  for (const name of ['song_data_raw.json','song_data.json','rating_structured_with_ids.json','song_alias.json']) {
    hash.update(`\0${name}\0`);
    try { for await (const chunk of createReadStream(resolve(getRuntimePaths().repoRoot,'songs',name))) hash.update(chunk); }
    catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; hash.update('absent'); }
  }
  return hash.digest('hex');
};
export function signRecommendation(receipt: Receipt) {
  const payload = Buffer.from(JSON.stringify(receipt)).toString('base64url');
  return payload + '.' + createHmac('sha256', key).update(payload).digest('base64url');
}
function readReceipt(token: unknown): Receipt {
  if (typeof token !== 'string' || token.length > 4096) throw createError({statusCode:400,statusMessage:'invalid-recommendation'});
  const parts = token.split('.'), [payload, signature] = parts;
  const expected = createHmac('sha256', key).update(payload || '').digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (parts.length !== 2 || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw createError({statusCode:409,statusMessage:'recommendation-expired'});
  let receipt: Receipt;
  try { receipt = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw createError({statusCode:400,statusMessage:'invalid-recommendation'}); }
  if (receipt.expires < Date.now()) throw createError({statusCode:409,statusMessage:'recommendation-expired'});
  return receipt;
}
export async function validateRecommendation(userId: number, binding: {id:number;taiko_id:string;source:string}, token: unknown, connection = getAccountDb() as Pick<PoolConnection,'execute'>, modelRevision?: string) {
  const receipt = readReceipt(token);
  if (receipt.userId !== userId || receipt.profileId !== String(binding.id) || receipt.account !== binding.taiko_id || receipt.source !== binding.source) throw createError({statusCode:409,statusMessage:'profile-changed'});
  const [snapshot, catalog] = await Promise.all([readGoalSnapshot(binding.taiko_id, true), getSongCatalog()]);
  if (receipt.revision !== snapshot.revision || receipt.inputs !== await recommendationInputRevision(catalog, modelRevision)) throw createError({statusCode:409,statusMessage:'recommendation-changed'});
  const song = catalog.find(s => Number(s.id) === receipt.songId);
  const [locks] = await connection.execute<any[]>('SELECT id FROM web_song_locks WHERE taiko_id=? AND song_no=? AND level=? AND is_locked=1 LIMIT 1', [binding.taiko_id,receipt.songId,receipt.difficultyType]);
  const baseline = goalBaseline(snapshot.current.songs?.find(r => Number(r.song_no) === receipt.songId && Number(r.level) === receipt.difficultyType), snapshot.revision, snapshot.capturedAt, snapshot.provenance ? 'complete' : 'unknown');
  baseline.provenance = locks.length ? null : snapshot.provenance;
  // The current evaluator needs a present baseline record for causal evidence.
  // Unplayed recommendations remain browsable without promising an unfinishable goal.
  const options = baseline.provenance && baseline.recordPresent ? goalOptions(baseline, binding.source, goalChartAvailable(song,receipt.difficultyType)) : [];
  return {receipt, baseline, options, song};
}
export const previewRecommendationGoal = (userId: number, token: unknown) => withPersonalScoreRead(userId, async binding => {
  const {receipt, options, song} = await validateRecommendation(userId,binding,token);
  const activeGoal = await readActiveGoal(getAccountDb(),userId,binding.id);
  return {profileId:receipt.profileId, scoreRevision:receipt.revision, songId:receipt.songId, difficultyType:receipt.difficultyType, title:song?.song_name || `#${receipt.songId}`, starLevel:song ? Number(song[`level_${receipt.difficultyType}` as keyof typeof song]) : null, goalOptions:options, activeGoal};
});
