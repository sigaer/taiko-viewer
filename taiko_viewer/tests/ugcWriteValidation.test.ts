import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDifficultyVoteValue, normalizeReportReason, normalizeTipBody, normalizeUgcTagSlugs } from "../server/services/ugc/validation.ts";

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

test("tip validation keeps plain text, normalizes whitespace, and counts unicode code points", () => {
  assert.equal(normalizeTipBody("  前半\r\n  后半  "), "前半\n后半");
  assert.equal(normalizeTipBody("😀".repeat(120)), "😀".repeat(120));
  for (const value of ["", " ".repeat(3), "😀".repeat(121), "<script>alert(1)</script>\u0000"]) {
    assert.throws(() => normalizeTipBody(value), (error) => Number((error as { statusCode?: number }).statusCode) === 400);
  }
  assert.equal(normalizeTipBody("<b>test</b>"), "<b>test</b>");
  assert.equal(normalizeTipBody("https://example.com"), "https://example.com");
});

test("report validation accepts only the declared reasons", () => {
  for (const reason of ["spam", "abuse", "advertising", "link", "duplicate", "other"]) {
    assert.equal(normalizeReportReason(reason), reason);
  }
  assert.throws(() => normalizeReportReason("unknown"), (error) => Number((error as { statusCode?: number }).statusCode) === 400);
});
