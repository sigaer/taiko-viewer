import { verifiedGoalProvenance } from './provenance';
import { getDomainScoreReader } from '../taiko-domain/read.ts';
export async function readGoalSnapshot(taikoId: string, verifyProvenance = false) {
  // Bypass the display cache: freeze the bytes actually read at this boundary.
  const { current, raw, revision, capturedAt } = await getDomainScoreReader().readCurrent(taikoId);
  return { current, provenance: verifyProvenance ? verifiedGoalProvenance(current, taikoId, raw) : null, revision, capturedAt };
}
