import assert from "node:assert/strict";
import test from "node:test";
import { hasVerifiedPlayRecord } from "../server/services/ugc/verified-play-predicate.ts";

const records = [{ song_no: 100, level: 4, high_score: 900000 }, { song_no: 100, level: 5, high_score: 0 }];
const effective = (song: Record<string, unknown>) => Number(song.high_score || 0) > 0;

test("verified play requires current wahlap or hiroba evidence", () => {
  assert.equal(hasVerifiedPlayRecord("wahlap", true, records, 100, 4, effective), true);
  assert.equal(hasVerifiedPlayRecord("hiroba", true, records, 100, 4, effective), true);
  assert.equal(hasVerifiedPlayRecord("manual", true, records, 100, 4, effective), false);
  assert.equal(hasVerifiedPlayRecord("wahlap", false, records, 100, 4, effective), false);
  assert.equal(hasVerifiedPlayRecord("wahlap", true, records, 100, 5, effective), false);
  assert.equal(hasVerifiedPlayRecord("wahlap", true, records, 999, 4, effective), false);
});
