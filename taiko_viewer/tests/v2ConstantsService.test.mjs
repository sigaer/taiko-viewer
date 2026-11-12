import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

test("V2 service and CSV share remote priority and survive a cold source outage", async () => {
  const viewer = fileURLToPath(new URL("..", import.meta.url));
  const out = await mkdtemp("/var/tmp/taiko-v2-service-test-");
  const dataset = JSON.parse(await readFile(`${viewer}/assets/data/v2_console_constants.json`, "utf8"));
  const catalog = Object.entries(dataset.provenance).map(([sid, source]) => {
    const song = { id: Number(sid), song_name: source.songName, type: "test", shelf_status: 2, max_combo: ["-", "-", "-", "-", "-"] };
    for (const [difficulty, identity] of Object.entries(source.charts)) {
      const offset = ["hard", "oni", "edit"].indexOf(difficulty) + 2;
      song.max_combo[offset] = identity.catalogNotes;
      song[`level_${offset + 1}`] = identity.catalogLevel;
    }
    return song;
  });
  catalog.push({ id: 1, song_name: 'CSV, "Song"\nTitle', type: "test", shelf_status: 0,
    level_4: 8, max_combo: ["-", "-", "-", 100, "-"] });
  const base = { totalNotes: 100, sub_constant_1: 5, main_constant: 6, sub_constant_2: 7,
    stamina: 0, handspeed: 3, burst: 4, complex: 5, rhythm: 6 };
  const payload = { "1": { oni: base }, "100001": { oni: { ...dataset.constants["100001"].oni, main_constant: 9 } } };
  const globals = { useRuntimeConfig: globalThis.useRuntimeConfig, $fetch: globalThis.$fetch, createError: globalThis.createError };
  try {
    await build({ entryPoints: [`${viewer}/server/services/content/v2Constants.ts`], outfile: `${out}/service.mjs`,
      bundle: true, platform: "node", format: "esm", alias: { "~": viewer }, logLevel: "silent",
      plugins: [{ name: "catalog-fixture", setup(builder) {
        builder.onResolve({ filter: /^\.\/songs$/ }, () => ({ path: "catalog", namespace: "fixture" }));
        builder.onLoad({ filter: /^catalog$/, namespace: "fixture" }, () => ({
          contents: `const catalog = ${JSON.stringify(catalog)}; export const getSongCatalog = async () => catalog; export const resolveCatalogSongId = async id => catalog.find(s => s.id === id || s.legacy_ids?.includes(id))?.id ?? id;`, loader: "js"
        }));
      } }] });
    await mkdir(`${out}/cached`);
    const fetchedAt = new Date().toISOString();
    await writeFile(`${out}/cached/v2-constants.json`, JSON.stringify({ version: 1, savedAt: fetchedAt,
      data: { payload, fetchedAt, expiresAt: Date.now() + 3600000 } }));
    let calls = 0;
    let directory = `${out}/cached`;
    globalThis.useRuntimeConfig = () => ({ repoRoot: out, public: {}, viewerCacheDir: directory, v2ConstantsUrl: "https://source.invalid/constants" });
    globalThis.$fetch = async () => { calls++; throw new Error("source unavailable"); };
    globalThis.createError = value => Object.assign(new Error(value.statusMessage), value);
    const service = await import(`${out}/service.mjs?cached`);
    const rows = await service.getV2ConstantsPayload({ keyword: "100001" });
    assert.equal(rows.items.find(r => r.difficulty === "oni").mainConstant, 9);
    assert.equal(rows.items.length, 2);
    assert.equal(rows.stale, false);
    const csv = await service.getV2ConstantsCsvDataset();
    assert.ok(csv.body.startsWith("id,title,difficulty,totalNotes,"));
    assert.ok(csv.body.includes('1,"CSV, ""Song""\nTitle",oni,100,'));
    assert.equal(csv.body.split("\n").filter(line => /^100\d{3},/.test(line)).length, 291);
    assert.equal(calls, 0);

    directory = `${out}/empty`;
    const offline = await import(`${out}/service.mjs?offline`);
    const fallback = await offline.getV2ConstantsPayload({ pageSize: 100 });
    assert.equal(fallback.total, 291);
    assert.equal(fallback.stale, true);
    assert.equal(fallback.fetchedAt, "");
    const fallbackCsv = await offline.getV2ConstantsCsvDataset();
    assert.equal(fallbackCsv.body.split("\n").filter(line => /^100\d{3},/.test(line)).length, 291);
    assert.equal((await offline.getSongV2ConstantsPayload(100033)).items.find(r => r.difficulty === "oni").totalNotes, 362);
    assert.equal(calls, 1, "cold outages must observe retry backoff");
    await mkdir(`${out}/songs`);
    await writeFile(`${out}/songs/catalog_constants.json`, JSON.stringify({ generatedAt: fetchedAt,
      constants: { "1": { oni: base } },
      provenance: { "1": { charts: { oni: { course: "oni", branch: "master", catalogNotes: 100, catalogLevel: 8 } } } }
    }));
    assert.equal((await offline.getV2ConstantsPayload()).total, 292);
    assert.equal((await offline.getSongV2ConstantsPayload(1)).items[0].mainConstant, 6);
    assert.ok((await offline.getV2ConstantsCsvDataset()).body.includes('1,"CSV, ""Song""\nTitle",oni,100,'));
    await writeFile(`${out}/songs/catalog_constants.json`, "{");
    assert.equal((await offline.getSongV2ConstantsPayload(1)).items[0].mainConstant, 6, "bad publications retain the last valid runtime generation");
  } finally {
    for (const [name, value] of Object.entries(globals)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
    await rm(out, { recursive: true, force: true });
  }
});
