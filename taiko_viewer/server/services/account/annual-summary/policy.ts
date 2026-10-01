import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createError } from 'h3';

export type AnnualPolicy = { mode: 'invite' | 'public'; pauseGeneration: boolean; pauseRendering: boolean; refreshImports: boolean; archiveFallback: boolean };
export const DEFAULT_ANNUAL_POLICY: AnnualPolicy = { mode: 'invite', pauseGeneration: false, pauseRendering: false, refreshImports: false, archiveFallback: false };
export const parseAnnualPolicy = (input: unknown): AnnualPolicy => {
  const p = input as AnnualPolicy;
  if (!p || !['invite', 'public'].includes(p.mode) || typeof p.pauseGeneration !== 'boolean' || typeof p.pauseRendering !== 'boolean') {
    throw new Error('Invalid annual policy');
  }
  for (const key of ['refreshImports', 'archiveFallback'] as const) {
    if (p[key] !== undefined && typeof p[key] !== 'boolean') throw new Error('Invalid annual policy');
  }
  return { mode: p.mode, pauseGeneration: p.pauseGeneration, pauseRendering: p.pauseRendering, refreshImports: p.refreshImports ?? false, archiveFallback: p.archiveFallback ?? false };
};
export const readAnnualPolicy = async (): Promise<AnnualPolicy> => {
  const path = process.env.TAIKO_ANNUAL_POLICY_FILE || join(process.env.ANNUAL_E2E_ISOLATED_ROOT || '/var/lib/taiko', 'annual-policy.json');
  try { return parseAnnualPolicy(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_ANNUAL_POLICY };
    throw createError({ statusCode: 503, statusMessage: '年度服务配置暂不可用，请稍后重试', data: { code: 'ANNUAL_POLICY_UNAVAILABLE' } });
  }
};
export const assertAnnualTaskAllowed = async (task: 'generation' | 'rendering') => {
  const policy = await readAnnualPolicy();
  if (task === 'generation' ? policy.pauseGeneration : policy.pauseRendering) {
    throw Object.assign(createError({ statusCode: 503, statusMessage: task === 'generation' ? '年度报告新生成已暂停，请稍后重试' : '年度分享图片新生成已暂停，请稍后重试', data: { code: task === 'generation' ? 'ANNUAL_GENERATION_PAUSED' : 'ANNUAL_RENDERING_PAUSED' } }), { retryAfter: 60 });
  }
};
