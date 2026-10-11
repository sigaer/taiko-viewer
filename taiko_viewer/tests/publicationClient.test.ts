import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openPublicationLease, withPublicationLease, PublicationUnavailableError } from "../server/infrastructure/taiko-publication/client.ts";

// Cross-repository integration uses the actual center infrastructure source.
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || "/home/sigaer/git/Sakura_bot/taiko";

async function fixture(task: (root: string) => Promise<void>) {
  const root = await mkdtemp("/var/tmp/domain-publication-client-");
  try { await task(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test("real Node/Python pipe publishes one staged current/history batch", async () => fixture(async root => {
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    assert.equal(lease.view, null);
    await lease.put("current", '{ "songs": [] }\n');
    await lease.put("history/data_20261011_090000_000001_web-account.json", '{"songs":[]}');
    const published = await lease.publish();
    assert.equal(published.sequence, 1);
    assert.equal(Object.keys(published.files).length, 2);
    assert.equal(lease.view?.commitId, published.commitId);
  });
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, async lease => {
    assert.equal(lease.view?.sequence, 1);
    const reference = lease.view!.files.current;
    const raw = await readFile(join(root, ".taiko-publications", "synthetic", "objects", reference.sha256), "utf8");
    assert.equal(raw, '{ "songs": [] }\n');
  });
}));

test("read pipe refuses writes and releases its lease on failure", async () => fixture(async root => {
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, async lease => {
    await lease.put("current", "PRIVATE_BODY");
  }), error => error instanceof PublicationUnavailableError && !error.message.includes("PRIVATE_BODY"));
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", '{"songs":[]}');
    await lease.publish();
  });
}));

test("callback exception preserves the error and exits the child", async () => fixture(async root => {
  const expected = new Error("Synthetic callback failure");
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async () => {
    throw expected;
  }), error => error === expected);
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    assert.equal(lease.view, null);
  });
}));

test("two actual pipe readers hold concurrent shared leases", async () => fixture(async root => {
  const options = { root, repoRoot, identity: "synthetic", mode: "read" as const };
  const first = await openPublicationLease(options);
  let second: Awaited<ReturnType<typeof openPublicationLease>> | undefined;
  try {
    second = await openPublicationLease(options);
    assert.equal(second.view, null);
  } finally {
    await second?.close();
    await first.close();
  }
}));

test("missing Python module fails closed and does not expose subprocess diagnostics", async () => fixture(async root => {
  await assert.rejects(openPublicationLease({ root, repoRoot: root, identity: "synthetic", mode: "write" }),
    error => error instanceof PublicationUnavailableError && !error.message.includes(root));
}));

test("pipe lifetime expires and then a fresh writer can acquire the kernel lease", async () => fixture(async root => {
  const lease = await openPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read", lifetimeSeconds: 1 });
  try {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await assert.rejects(lease.put("current", "PRIVATE_BODY"), PublicationUnavailableError);
  } finally { await lease.close(); }
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async next => {
    assert.equal(next.view, null);
  });
}));

test("actual backup RPC adopts legacy source and returns a stable receipt without a path", async () => fixture(async root => {
  const key = "b".repeat(32);
  await mkdir(join(root, "synthetic"));
  await writeFile(join(root, "syntheticdata.json"), '{ "songs": [] }\n');
  await writeFile(join(root, "synthetic", "daily-ability-v1-top20.json"), '{"days":{"2026-10-10":123}}');
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    const first = await lease.backup(key);
    assert.deepEqual(Object.keys(first), ["backupKey", "source"]);
    assert.equal(first.source.commitId, lease.view?.commitId);
    assert.equal(first.source.sequence, 0);
    assert.equal(await readFile(join(root, ".manual_deleted", `synthetic-${key}`, "syntheticdata.json"), "utf8"), '{ "songs": [] }\n');
    await lease.put("current", '{"songs":[],"changed":true}');
    const next = await lease.publish();
    const retry = await lease.backup(key);
    assert.deepEqual(retry, first);
    assert.equal(lease.view?.commitId, next.commitId);
    assert.notEqual(retry.source.commitId, next.commitId);
  });
}));

test("actual backup RPC rejects SH and uncommitted score stages", async () => fixture(async root => {
  const key = "a".repeat(32);
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, lease => lease.backup(key)), PublicationUnavailableError);
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", '{"songs":[]}');
    await lease.backup(key);
  }), PublicationUnavailableError);
  await assert.rejects(readFile(join(root, ".manual_deleted", `synthetic-${key}`, "backup.json")), { code: "ENOENT" });
}));

test("actual recovery pipe verifies independent copies and restores C/H/daily in one owned EX", async () => fixture(async root => {
  const key = "d".repeat(32), transactionId = "e".repeat(32);
  const raw = '{ "songs": [] }\n', daily = '{"days":{"2026-10-10":123}}';
  await mkdir(join(root, "synthetic"));
  await writeFile(join(root, "syntheticdata.json"), raw);
  await writeFile(join(root, "synthetic", "daily-ability-v1-top20.json"), daily);
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    const original = await lease.backup(key);
    assert.deepEqual(await lease.verifyBackup(key), original);
    await lease.remove("current");
    await lease.purgeBackupArchives(key);
    await lease.publish({ replaceHistory: true });
    const restored = await lease.restoreBackup(key, transactionId);
    assert.equal(restored.commitId, transactionId);
    assert.equal(lease.view?.commitId, transactionId);
    assert.equal(await readFile(join(root, "syntheticdata.json"), "utf8"), raw);
    assert.equal(await readFile(join(root, "synthetic", "daily-ability-v1-top20.json"), "utf8"), daily);
    assert.equal((await lease.restoreBackup(key, transactionId)).sequence, restored.sequence);
    await lease.put("current", "new uncommitted");
    await assert.rejects(lease.restoreBackup(key, transactionId), PublicationUnavailableError);
  });
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, lease => lease.restoreBackup(key, transactionId)), PublicationUnavailableError);
}));
