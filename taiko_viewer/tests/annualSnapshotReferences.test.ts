import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectSnapshotHashesFromJsonFile } from "../server/services/account/annual-summary/snapshot-references.ts";

test("annual snapshot references are collected across stream chunk boundaries", async () => {
  const root = await mkdtemp("/var/tmp/annual-snapshot-references-");
  const filePath = resolve(root, "summary.json");
  const sha256 = "a".repeat(64);
  const contentHash = "B".repeat(64);
  const unrelatedHash = "c".repeat(64);
  try {
    await writeFile(filePath, JSON.stringify({
      padding: "x".repeat(65_520),
      nested: [{ sha256 }, { contentHash }],
      unrelatedHash,
      note: `embedded text: \"sha256\":\"${unrelatedHash}\"`
    }));

    const references = await collectSnapshotHashesFromJsonFile(filePath);
    assert.deepEqual([...references].sort(), [sha256, contentHash.toLowerCase()]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("annual snapshot reference scanning can accumulate into an existing set", async () => {
  const root = await mkdtemp("/var/tmp/annual-snapshot-references-");
  const filePath = resolve(root, "events.json");
  const existing = "d".repeat(64);
  const discovered = "e".repeat(64);
  try {
    await writeFile(filePath, JSON.stringify([{ contentHash: discovered }, { sha256: discovered }]));
    const references = await collectSnapshotHashesFromJsonFile(filePath, new Set([existing]));
    assert.deepEqual([...references].sort(), [existing, discovered]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
