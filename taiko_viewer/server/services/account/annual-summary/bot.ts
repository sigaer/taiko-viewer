import { getTaikoPythonEnv } from "~/server/utils/taiko-python";
import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createError, type H3Event } from 'h3';
import { getAccountDb, ensureAccountSchema, type DbRow } from '~/server/utils/account-db';
import { getRuntimePaths } from '~/server/internal/account/shared';
import { annualAdmission } from './admission';
import { spawnAnnualWorker, stopAnnualWorker } from './isolated-worker';
import { assertAnnualTaskAllowed, readAnnualPolicy } from './policy';
import { atomicWriteFile, atomicWriteJson, getAnnualInputFingerprint, readAnnualDiskState, runAnnualSummaryCli, withAnnualFileLock } from './runtime';
import { botAnnualPaths, readBotAnnualSummary } from './bot-store';
import { ANNUAL_SHARE_CARD_RENDERER_REVISION, getAnnualVersion } from './constants';
import { createAccountAnnualShareCard, getOwnerAnnualShareCardPath, getReusableBotAnnualSummary } from './index';
import { renderAnnualShareCard } from './poster';
import { enrichAnnualRatingRank } from './ratings';

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
const pending = new Map<string, Promise<Buffer>>();
const exists = (path: string) => access(path).then(() => true).catch(() => false);

export const resolveBotAnnualBinding = async (identity: string) => {
  if (!/^qq_official:[A-Za-z0-9_-]{1,128}$/.test(identity)) throw createError({ statusCode: 403, statusMessage: '仅支持 QQ 官方机器人' });
  await ensureAccountSchema();
  const [rows] = await getAccountDb().execute<DbRow<{ id: string; current_virtual: number }>[]>(
    `SELECT b.id, COALESCE(s.current_virtual,0) AS current_virtual FROM bind b
     LEFT JOIN taiko_bind_identity_state s ON BINARY s.identity_key=BINARY b.qq
     WHERE b.qq=? AND b.is_current=1 LIMIT 2`, [identity]);
  if (rows.length !== 1) throw createError({ statusCode: 400, statusMessage: '请先绑定鼓众 ID' });
  if (Number(rows[0].current_virtual)) throw createError({ statusCode: 400, statusMessage: '请先切换到一个真实绑定账号，再生成版本总结' });
  return String(rows[0].id);
};

// Only run-owned Bot cache revisions; retain the previous successful image.
const pruneBotRevisions = async (dir: string, currentImage: string) => {
  const names = (await readdir(dir)).filter(n => /^[a-f0-9]{32}\.png$/.test(n));
  const entries = [];
  for (const name of names) entries.push({name,mtime:(await stat(join(dir,name))).mtimeMs});
  const previous = entries.filter(e => join(dir,e.name) !== currentImage).sort((a,b)=>b.mtime-a.mtime);
  for (const entry of previous.slice(1)) {
    const prefix = entry.name.slice(0,-4);
    for (const suffix of ['.png','.json','.my-don.png']) await unlink(join(dir,prefix+suffix)).catch(()=>undefined);
  }
};

const buildMyDon = async (taikoId: string, path: string) => {
  if (await exists(path)) return;
  const { repoRoot, configPath, userdataDir } = getRuntimePaths();
  await annualAdmission.run('generator', `bot-mydon:${path}`, 60_000, async id => {
    const child = await spawnAnnualWorker('generator', id, {
      cwd: repoRoot, args: ['-I', '-m', 'taiko_bot.offline.my_don_cli', 'render', '--taiko-id', taikoId],
      env: { ...getTaikoPythonEnv(repoRoot), TAIKO_CONFIG_PATH: configPath, TAIKO_USERDATA_DIR: userdataDir }
    }, 60_000);
    const image = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []; let size = 0; let oversized = false;
      child.stdout.on('data', (b: Buffer) => {
        size += b.length;
        if (size > 20 * 1024 * 1024) { oversized = true; void stopAnnualWorker('generator', id); }
        else chunks.push(b);
      });
      child.stderr.resume();
      child.once('error', reject);
      child.once('close', code => code === 0 && !oversized ? resolve(Buffer.concat(chunks)) : reject(new Error('MyDon render failed')));
    });
    if (!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid MyDon image');
    await atomicWriteFile(path, image);
    return { path };
  });
};

const produceBotCard = async (event: H3Event, taikoId: string) => {
  const policy = await readAnnualPolicy();
  if (policy.mode !== 'public') throw createError({ statusCode: 403, statusMessage: '版本总结暂未开放，请稍后再试' });
  const existing = await getReusableBotAnnualSummary(taikoId);
  if (existing) {
    const card = await createAccountAnnualShareCard(event, existing.row.user_id, existing.row.id,
      { locale: 'zh', syncCommunity: false, actorUsername: '' });
    return readFile(await getOwnerAnnualShareCardPath(existing.row.user_id, card.shareCard.id));
  }
  const fingerprint = await getAnnualInputFingerprint(taikoId);
  const id = `bot_${hash(taikoId)}_${hash(`${fingerprint}:${policy.archiveFallback}:${ANNUAL_SHARE_CARD_RENDERER_REVISION}`)}`;
  const paths = botAnnualPaths(id);
  return withAnnualFileLock(`bot-card:${taikoId}`, async () => {
    if (await exists(paths.image)) return readFile(paths.image);
    if (!(await readAnnualDiskState()).acceptsNewBuilds) throw createError({ statusCode: 503, statusMessage: '年度服务空间不足，请稍后再试' });
    if (!(await exists(paths.summary))) {
      await assertAnnualTaskAllowed('generation');
      const result = await runAnnualSummaryCli(taikoId, undefined, undefined, policy.archiveFallback);
      if (fingerprint !== await getAnnualInputFingerprint(taikoId)) throw createError({ statusCode: 409, statusMessage: '数据已更新，请稍后重新查询' });
      const summary = await enrichAnnualRatingRank({ ...result.summary, version: getAnnualVersion() });
      await atomicWriteJson(paths.summary, summary);
    } else await readBotAnnualSummary(id);
    // Use the same MyDon CLI, confined to the same generator budget; no Bot-side renderer.
    if (!(await exists(paths.myDon))) {
      await assertAnnualTaskAllowed('generation');
      await buildMyDon(taikoId, paths.myDon);
    }
    await renderAnnualShareCard({ summaryId: id, locale: 'zh', outputPath: paths.image });
    if (fingerprint !== await getAnnualInputFingerprint(taikoId)) throw createError({ statusCode: 409, statusMessage: '数据已更新，请稍后重新查询' });
    await pruneBotRevisions(paths.dir, paths.image).catch(() => undefined);
    return readFile(paths.image);
  });
};

export const getBotAnnualCard = async (event: H3Event, identity: string) => {
  const taikoId = await resolveBotAnnualBinding(identity);
  const key = taikoId;
  let task = pending.get(key);
  if (!task) {
    // Bound HTTP waiters as well as the shared host-wide generator/render queues.
    if (pending.size >= 4) throw createError({ statusCode: 429, statusMessage: '版本总结服务繁忙，请稍后再试' });
    task = produceBotCard(event, taikoId).finally(() => pending.delete(key));
    pending.set(key, task);
  }
  const image = await task;
  if (await resolveBotAnnualBinding(identity) !== taikoId) throw createError({ statusCode: 409, statusMessage: '当前绑定已切换，请重新查询' });
  return image;
};
