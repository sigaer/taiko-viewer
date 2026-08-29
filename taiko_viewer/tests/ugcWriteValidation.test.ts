import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDifficultyVoteValue, normalizeUgcTagSlugs } from "../server/services/ugc/validation.ts";

test("difficulty write validation accepts only the five ordinal values and null", () => {
  for (const value of [-2, -1, 0, 1, 2, null]) assert.equal(normalizeDifficultyVoteValue(value), value);
  for (const value of [-3, 3, "1", undefined, Number.NaN]) {
    assert.throws(() => normalizeDifficultyVoteValue(value), (error) => Number((error as { statusCode?: number }).statusCode) === 400);
  }
});

test("tag write validation trims, deduplicates, and enforces the five-tag limit", () => {
  assert.deepEqual(normalizeUgcTagSlugs(["stamina", " stamina ", "high-speed"]), ["stamina", "high-speed"]);
  assert.deepEqual(normalizeUgcTagSlugs([]), []);
  assert.throws(
    () => normalizeUgcTagSlugs(["a", "b", "c", "d", "e", "f"]),
    (error) => Number((error as { statusCode?: number }).statusCode) === 400
  );
  for (const value of [null, "stamina", ["stamina", 1], [""]]) {
    assert.throws(() => normalizeUgcTagSlugs(value), (error) => Number((error as { statusCode?: number }).statusCode) === 400);
  }
});
