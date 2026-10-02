import { createError } from 'h3';
import { resolve } from 'node:path';
import { getAnnualCacheRoot, readAnnualSummary } from './runtime';

export const botAnnualPaths = (id: string) => {
  const match = /^bot_([a-f0-9]{32})_([a-f0-9]{32})$/.exec(id);
  if (!match) throw createError({ statusCode: 404, statusMessage: '报告不存在' });
  const dir = resolve(getAnnualCacheRoot(), 'bot', match[1]);
  const prefix = resolve(dir, match[2]);
  return { dir, summary: `${prefix}.json`, myDon: `${prefix}.my-don.png`, image: `${prefix}.png` };
};
export const readBotAnnualSummary = (id: string) => readAnnualSummary(botAnnualPaths(id).summary);
