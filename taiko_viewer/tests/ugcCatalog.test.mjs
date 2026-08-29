import assert from "node:assert/strict";
import test from "node:test";
import { buildUgcCatalogAudit, buildUgcChartSourceKey } from "../scripts/lib/ugc-catalog.mjs";

const baseSongs = [
  { id: 10, song_name: "Song A", level_1: 2, level_4: 8, level_5: "-", max_combo: [100, "-", "-", 500, "-"], shelf_status: 0 },
  { id: 20, song_name: "Song B", level_1: "-", level_4: 9, level_5: 10, max_combo: ["-", "-", "-", 700, 900], shelf_status: 1 }
];

test("catalog identity and revision are deterministic", () => {
  const input = {
    songs: baseSongs,
    ratingsPayload: { songs: [{ id: 10, level: 4 }] },
    noteCounts: { "Song A": { "Easy|2": { total: 100 }, "Oni|8": { total: 500 } } }
  };
  const first = buildUgcCatalogAudit(input);
  const second = buildUgcCatalogAudit({ ...input, songs: [...baseSongs].reverse() });
  assert.equal(first.catalog.revision, second.catalog.revision);
  assert.deepEqual(first.catalog.charts, second.catalog.charts);
  assert.equal(first.summary.chartsDiscovered, 4);
  assert.equal(first.summary.activeCharts, 2);
  assert.equal(first.summary.inactiveCharts, 2);
  assert.equal(first.summary.errors, 0);
  assert.equal(buildUgcChartSourceKey(10, 4), "taiko:10:4");
});

test("duplicate chart pairs are blocking errors", () => {
  const audit = buildUgcCatalogAudit({ songs: [baseSongs[0], baseSongs[0]], ratingsPayload: { songs: [] }, noteCounts: {} });
  assert.ok(audit.summary.errors > 0);
  assert.equal(audit.summary.duplicatePairs, 2);
});

test("missing rating and note count remain non-blocking warnings", () => {
  const audit = buildUgcCatalogAudit({ songs: [baseSongs[0]], ratingsPayload: { songs: [] }, noteCounts: {} });
  assert.equal(audit.summary.errors, 0);
  assert.ok(audit.summary.warnings > 0);
  assert.ok(audit.issues.some((issue) => issue.code === "RATING_MISSING"));
  assert.ok(audit.issues.some((issue) => issue.code === "NOTE_COUNT_MISSING"));
});
