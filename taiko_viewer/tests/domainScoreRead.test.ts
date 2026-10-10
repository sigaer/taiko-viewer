import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, utimes, truncate } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createFileScoreReader } from "../server/domain/file-score-reader.ts";
import { readDailyAbilityArchive } from "../server/services/growth-history/daily-archive.ts";

test("read port freezes exact bytes, preserves unknown/missing fields and rereads current", async () => {
  const dir = await mkdtemp("/var/tmp/domain-read-");
  try {
    const reader = createFileScoreReader(dir, () => "2026-10-11T02:00:00Z");
    assert.equal(await reader.currentExists("synthetic"), false);
    await assert.rejects(reader.readCurrent("synthetic"), { code: "ENOENT" });
    const raw = '{ "songs":[{"song_no":1,"level":4,"good_cnt":null,"option_flg":"custom"}],"_meta":{"x":1.0} }';
    await writeFile(resolve(dir, "syntheticdata.json"), raw);
    const first = await reader.readCurrent("synthetic");
    assert.equal(first.contractVersion, "1.0");
    assert.equal(first.raw, raw);
    assert.equal(first.revision, createHash("sha256").update(raw).digest("hex"));
    assert.equal(first.capturedAt, "2026-10-11T02:00:00Z");
    assert.equal(first.current.songs?.[0].good_cnt, null);
    assert.equal(first.current.songs?.[0].high_score, undefined);
    assert.equal(first.current.songs?.[0].option_flg, "custom");
    await writeFile(resolve(dir, "syntheticdata.json"), raw + "\n");
    assert.notEqual((await reader.readCurrent("synthetic")).revision, first.revision);
    assert.equal(await reader.readRawCurrent("synthetic"), raw + "\n");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("read port rejects path selectors before filesystem access", async () => {
  const reader = createFileScoreReader("/var/tmp/does-not-exist-domain", () => "clock");
  for (const id of ["", "../private", "a/b", "a\\b", "a\0b", "a".repeat(129)]) {
    await assert.rejects(reader.readCurrent(id), /Invalid score identity/);
    assert.throws(() => reader.listHistory(id), /Invalid score identity/);
  }
  for (const name of ["../data_a.json", "data_a/b.json", "current.json", "data_a\\b.json"]) {
    assert.throws(() => reader.readHistory("synthetic", name), /Invalid score history name/);
  }
});

test("history versions detect same-size rewrites even with restored mtime", async () => {
  const dir = await mkdtemp("/var/tmp/domain-history-");
  try {
    await mkdir(resolve(dir, "synthetic"));
    const name = "data_2026-10-11_02_00_00.json", file = resolve(dir, "synthetic", name);
    const reader = createFileScoreReader(dir, () => "clock");
    await writeFile(file, '{"songs":[]}');
    await utimes(file, 1700000000, 1700000000);
    const before = await reader.historyFileVersion("synthetic", name);
    // This filesystem records ctime at millisecond precision.
    await setTimeout(20);
    await writeFile(file, '{"songs":{}}');
    await utimes(file, 1700000000, 1700000000);
    assert.notEqual(await reader.historyFileVersion("synthetic", name), before);
    assert.deepEqual(await reader.listHistory("synthetic"), [name]);
    assert.equal(await reader.readHistory("synthetic", name), '{"songs":{}}');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("daily archive distinguishes missing, corrupt and oversized inputs", async () => {
  const dir = await mkdtemp("/var/tmp/domain-archive-");
  try {
    await mkdir(resolve(dir, "synthetic"));
    const file = resolve(dir, "synthetic", "daily-ability-v1-top20.json");
    const reader = createFileScoreReader(dir, () => "clock");
    assert.equal(await reader.readDailyAbility("synthetic"), undefined);
    await writeFile(file, "null");
    assert.equal(await reader.readDailyAbility("synthetic"), null);
    await assert.rejects(readDailyAbilityArchive(dir, "synthetic", 1, 1, "2026-10-01", "2026-10-11"));
    await writeFile(file, "bad json");
    await assert.rejects(reader.readDailyAbility("synthetic"), SyntaxError);
    await truncate(file, 8 * 1024 * 1024 + 1);
    await assert.rejects(reader.readDailyAbility("synthetic"), /too large/);
    await writeFile(file, '{"version":1,"days":{}}');
    assert.deepEqual(await reader.readDailyAbility("synthetic"), { version: 1, days: {} });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
