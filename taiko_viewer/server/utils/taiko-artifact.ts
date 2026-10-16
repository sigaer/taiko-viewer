import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getTaikoPython } from './taiko-python';

const execute = promisify(execFile);
export async function getTaikoArtifact() {
  const { stdout } = await execute(getTaikoPython(), ['-I', '-m', 'taiko_bot.offline.fingerprint'], {
    timeout: 30_000, maxBuffer: 64 * 1024, encoding: 'utf8'
  });
  const result = JSON.parse(stdout) as { protocol: number; identity: string; annualRoot: string; schemaPath: string };
  if (result.protocol !== 1 || !/^[0-9a-f]{64}$/.test(result.identity)) throw new Error('Invalid Taiko artifact identity');
  return result;
}
