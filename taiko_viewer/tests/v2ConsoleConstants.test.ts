import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildV2ConstantsRows } from "../server/services/content/v2ConstantsModel.ts";
import type { SongCatalogItem } from "../types/content.ts";

const dataset = JSON.parse(readFileSync(new URL("../assets/data/v2_console_constants.json", import.meta.url), "utf8"));
const chart = { totalNotes: 100, sub_constant_1: 5, main_constant: 6, sub_constant_2: 7,
  stamina: 0, handspeed: 3, burst: 4, complex: 5, rhythm: 6 };
const song: SongCatalogItem = { id: 100000, song_name: "Console", type: "test", shelf_status: 2,
  max_combo: [10, 20, 100, 200, "-"], level_3: 4, level_4: 7, level_5: "-" };
const supplement = { constants: { "100000": { hard: chart } }, provenance: { "100000": {
  charts: { hard: { catalogNotes: 100, catalogLevel: 4, course: "hard", branch: "master" } }
} } };

test("valid upstream data wins per difficulty while console gaps are filled", () => {
  const rows = buildV2ConstantsRows({ "100000": { oni: { ...chart, totalNotes: 200 } } }, [song], supplement);
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.difficulty === "hard")?.stamina, 0);
  assert.equal(rows.find(r => r.difficulty === "oni")?.totalNotes, 200);
  assert.equal(buildV2ConstantsRows({ "100000": { hard: { ...chart, main_constant: 9 } } }, [song], supplement)[0]?.mainConstant, 9);
});

test("missing and malformed values cannot become zero, valid aliases can still fill them", () => {
  for (const invalid of [null, undefined, "", " ", false, Infinity, "NaN"]) {
    const upstream = { "100000": { hard: { ...chart, main_constant: invalid } } };
    assert.equal(buildV2ConstantsRows(upstream, [song]).length, 0);
    assert.equal(buildV2ConstantsRows(upstream, [song], supplement)[0]?.mainConstant, 6);
  }
  assert.equal(buildV2ConstantsRows({ "100000": { hard_single: chart } }, [song])[0]?.totalNotes, 100);
  assert.equal(buildV2ConstantsRows({ "100000": { hard: { ...chart, main_constant: null }, hard_single: chart } }, [song]).length, 1);
});

test("supplements require current console catalog identity and a single course", () => {
  for (const altered of [{ ...song, shelf_status: 0 }, { ...song, max_combo: [10, 20, 101] },
    { ...song, level_3: 5 }, { ...song, level_3: "-" }]) {
    assert.equal(buildV2ConstantsRows({}, [altered], supplement).length, 0);
  }
  const double = structuredClone(supplement);
  double.provenance["100000"].charts.hard.course = "hard_p1";
  assert.equal(buildV2ConstantsRows({}, [song], double).length, 0);
  assert.equal(buildV2ConstantsRows({}, [], supplement).length, 0);
  assert.equal(buildV2ConstantsRows({}, [{ ...song, song_name: "【双打】Console" }], supplement).length, 0);
  assert.equal(buildV2ConstantsRows({}, [song], supplement).some(r => r.difficulty === "oni"), false);
});

test("generated dataset has complete provenance and passed reference calibration", () => {
  assert.equal(dataset.schemaVersion, 1);
  assert.equal(dataset.referenceChecks.length, 6);
  assert.ok(dataset.referenceChecks.every((r: { maxAbsDelta: number }) => r.maxAbsDelta <= 1e-9));
  assert.equal(Object.keys(dataset.constants).length, 143);
  const catalog: SongCatalogItem[] = [];
  for (const [sid, source] of Object.entries(dataset.provenance) as [string, any][]) {
    assert.match(source.tjaSha256, /^[a-f0-9]{64}$/);
    assert.ok(!source.tjaPath.startsWith("/") && !source.tjaPath.includes("../"));
    const item: SongCatalogItem = { id: Number(sid), song_name: source.songName, type: "test", shelf_status: 2,
      max_combo: ["-", "-", "-", "-", "-"] };
    for (const [difficulty, identity] of Object.entries(source.charts) as [string, any][]) {
      const offset = ["hard", "oni", "edit"].indexOf(difficulty) + 2;
      item.max_combo![offset] = identity.catalogNotes;
      (item as Record<string, unknown>)[`level_${offset + 1}`] = identity.catalogLevel;
    }
    catalog.push(item);
  }
  const rows = buildV2ConstantsRows({}, catalog, dataset);
  assert.equal(rows.length, dataset.coverage.generatedCharts);
  assert.equal(rows.length, 291);
  assert.equal(new Set(rows.map(r => r.id)).size, 143);
  assert.equal(dataset.coverage.requestedCharts, rows.length + dataset.issues.length);
  for (const issue of dataset.issues) {
    assert.equal(rows.some(r => r.id === issue.id && r.difficulty === issue.difficulty), false);
  }
  assert.equal(rows.find(r => r.id === 100033 && r.difficulty === "oni")?.totalNotes, 362);
  assert.equal(rows.filter(r => r.id === 100000).length, 1);
});
