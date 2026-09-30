import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Existing score writers use these suffixes for explicit corrections. Merely
// locking a chart and ordinary sync snapshots must not invalidate a report.
export const annualManualEditTime = async (userdataDir: string, taikoId: string) => {
  const directory = join(userdataDir, taikoId);
  const names = await readdir(directory).catch(error => {
    if (error.code === 'ENOENT') return [] as string[];
    throw error;
  });
  let latest = 0;
  for (const name of names) {
    if (!/^data_.*_(web-account|manual-score|manual-score-delete|web-score-import)\.json$/.test(name)) continue;
    const info = await stat(join(directory, name));
    latest = Math.max(latest, info.mtimeMs);
  }
  return latest;
};

export const annualCorrectionsAreCurrent = (
  algorithm: string | undefined, generatedAt: string, latestEdit: number
) => {
  if (algorithm === 'annual-observation-v4.5.2') return latestEdit === 0;
  if (algorithm !== 'annual-observation-v4.5.3') return false;
  return latestEdit <= Date.parse(generatedAt);
};
