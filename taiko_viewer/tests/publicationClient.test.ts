import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, mkdir, writeFile, utimes, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPublicationPython } from "../server/infrastructure/taiko-publication/python.ts";
import { openPublicationLease, withPublicationLease, PublicationUnavailableError } from "../server/infrastructure/taiko-publication/client.ts";

// The installed wheel is selected through TAIKO_PYTHON_EXECUTABLE. This root
// remains a working directory only; Python isolated mode must not import it.
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

test("actual pipe retains distinct legacy times for equal-content history objects", async () => fixture(async root => {
  await mkdir(join(root, "synthetic"));
  await writeFile(join(root, "syntheticdata.json"), "{}");
  for (const [name, time] of [["a", 1737000000.125], ["b", 1737086400.375]] as const) {
    const file = join(root, "synthetic", `data_legacy_${name}.json`);
    await writeFile(file, "{}"); await utimes(file, time, time);
  }
  const before = await stat(join(root, "syntheticdata.json"));
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", "{}"); const manifest = await lease.publish();
    assert.deepEqual(manifest.files["history/data_legacy_a.json"], manifest.files["history/data_legacy_b.json"]);
    assert.equal(manifest.fileMtimes!["history/data_legacy_a.json"], 1737000000.125);
    assert.equal(manifest.fileMtimes!["history/data_legacy_b.json"], 1737086400.375);
    assert.ok(Math.abs(manifest.fileCtimes!.current - before.ctimeMs / 1000) < .001);
  });
  await unlink(join(root, "synthetic", "data_legacy_a.json"));
  await unlink(join(root, "synthetic", "data_legacy_b.json"));
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, async lease => {
    assert.equal((await lease.fileTimes("history/data_legacy_a.json")).mtime, 1737000000.125);
    assert.equal((await lease.fileTimes("history/data_legacy_b.json")).mtime, 1737086400.375);
  });
}));

test("metadata RPC fails closed for absent keys, canonical corruption and staged bytes", async () => fixture(async root => {
  let hash = "";
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", "{}"); hash = (await lease.publish()).files.current.sha256;
  });
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, lease => lease.fileTimes("history/data_absent.json")), PublicationUnavailableError);
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", "{}"); await lease.fileTimes("current");
  }), PublicationUnavailableError);
  await writeFile(join(root, ".taiko-publications", "synthetic", "objects", hash), "corrupt");
  await assert.rejects(withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "read" }, lease => lease.fileTimes("current")), PublicationUnavailableError);
}));

test("actual pipe backup/delete/restore keeps the captured source filesystem times", async () => fixture(async root => {
  await withPublicationLease({ root, repoRoot, identity: "synthetic", mode: "write" }, async lease => {
    await lease.put("current", "{}"); await lease.put("history/data_legacy.json", "{}");
    const original = await lease.publish(); await lease.backup("b".repeat(32));
    await lease.remove("current"); await lease.remove("history/data_legacy.json"); await lease.publish();
    const restored = await lease.restoreBackup("b".repeat(32), "c".repeat(32));
    assert.deepEqual(restored.fileMtimes, original.fileMtimes); assert.deepEqual(restored.fileCtimes, original.fileCtimes);
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
  const emptyVenv = join(root, "empty-venv");
  await promisify(execFile)(getPublicationPython(), ["-I", "-m", "venv", "--without-pip", emptyVenv], { timeout: 30000, maxBuffer: 8192 });
  await assert.rejects(openPublicationLease({ root, repoRoot, python: join(emptyVenv, "bin", "python"), identity: "synthetic", mode: "write" }),
    error => error instanceof PublicationUnavailableError && !error.message.includes(root));
}));

test("installed bridge ignores same-name packages in cwd and PYTHONPATH", async () => fixture(async root => {
  const cwd = join(root, "hostile-cwd");
  const injected = join(root, "hostile-pythonpath");
  const marker = join(root, "unexpected-import");
  for (const directory of [cwd, injected]) {
    await mkdir(join(directory, "taiko_store"), { recursive: true });
    await writeFile(join(directory, "taiko_store", "__init__.py"), `from pathlib import Path\nPath(${JSON.stringify(marker)}).write_text('executed')\nraise RuntimeError('shadow package executed')\n`);
    await writeFile(join(directory, "taiko_store", "bridge.py"), "raise RuntimeError('shadow bridge executed')\n");
  }
  const previous = process.env.PYTHONPATH;
  process.env.PYTHONPATH = injected;
  try {
    let commitId = "";
    await withPublicationLease({ root, repoRoot: cwd, identity: "synthetic", mode: "write" }, async lease => {
      await lease.put("current", '{"songs":[]}');
      commitId = (await lease.publish()).commitId;
    });
    await withPublicationLease({ root, repoRoot: cwd, identity: "synthetic", mode: "read" }, async lease => {
      assert.equal(lease.view?.commitId, commitId);
    });
    await assert.rejects(stat(marker), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.PYTHONPATH;
    else process.env.PYTHONPATH = previous;
  }
}));

test("relative interpreter configuration is rejected without exposing its value", async () => fixture(async root => {
  const options = { root, repoRoot, identity: "synthetic", mode: "write" as const };
  for (const python of ["python3", "relative/private-python", "/bad\0python"]) {
    await assert.rejects(openPublicationLease({ ...options, python }),
      error => error instanceof PublicationUnavailableError && !error.message.includes(python));
  }
  const previous = process.env.TAIKO_PYTHON_EXECUTABLE;
  process.env.TAIKO_PYTHON_EXECUTABLE = "relative/private-python";
  try { await assert.rejects(openPublicationLease(options), PublicationUnavailableError); }
  finally {
    if (previous === undefined) delete process.env.TAIKO_PYTHON_EXECUTABLE;
    else process.env.TAIKO_PYTHON_EXECUTABLE = previous;
  }
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
