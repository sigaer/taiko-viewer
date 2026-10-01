import { createHash } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const annualImportState = async (directory: string, taikoId: string) => {
  const root = join(directory, taikoId);
  const names = (await readdir(root).catch(error => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  })).filter(name => /^data_.*_kinoko-(?:import|history-current|history_[a-f0-9]+)\.json$/.test(name)).sort();
  const hash = createHash('sha256');
  let latest = 0;
  for (const name of names) {
    const info = await stat(join(root, name));
    hash.update(JSON.stringify([name, info.size, info.mtimeMs]));
    latest = Math.max(latest, info.mtimeMs);
  }
  return { revision: names.length ? hash.digest('hex') : '', latest };
};

export const annualImportNeedsRefresh = (summary: { generatedAt: string; provenance?: { warnings?: string[] } }, state: { revision: string; latest: number }) => {
  if (!state.revision) return false;
  const marker = summary.provenance?.warnings?.find(value => value.startsWith('kinoko_revision:'));
  return marker ? marker !== `kinoko_revision:${state.revision}` : state.latest > Date.parse(summary.generatedAt);
};
