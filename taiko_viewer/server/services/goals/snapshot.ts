import { verifiedGoalProvenance } from './provenance';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { getUserdataPath, type UserdataPayload } from '../../internal/account/shared';
export async function readGoalSnapshot(taikoId: string, verifyProvenance = false) {
  // Bypass the display cache: freeze the bytes actually read at this boundary.
  const raw = await readFile(getUserdataPath(taikoId), 'utf8');
  const current = JSON.parse(raw) as UserdataPayload;
  return { current, provenance: verifyProvenance ? verifiedGoalProvenance(current, taikoId, raw) : null, revision: createHash('sha256').update(raw).digest('hex'), capturedAt: new Date().toISOString() };
}
