import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { withScoreRead, withScoreWrite, currentScoreScope, stageScoreText, removeScoreProjection, onScoreRollback, scorePublication, createScoreBackup } from "../server/infrastructure/taiko-publication/scope.ts";
import { PublicationUnavailableError } from "../server/infrastructure/taiko-publication/client.ts";
import type { ScoreReadPort } from "../server/domain/score-read-contract.ts";
const repoRoot = process.env.TAIKO_PUBLICATION_TEST_REPO_ROOT || "/home/sigaer/git/Sakura_bot/taiko";
const identity = "synthetic";
const history = "data_20261011_090000_000000_00000000000000000001_wahlap.json";
const now = () => "2026-10-11T01:00:00.000Z";
async function fixture(task: (options: { root: string; repoRoot: string; identity: string; now: () => string }) => Promise<void>) {
  const root = await mkdtemp("/var/tmp/score-source-scope-");
  try { await task({ root, repoRoot, identity, now }); }
  finally { await rm(root, { recursive: true, force: true }); }
}
async function seed(options: Parameters<typeof withScoreRead>[0]) {
  await withScoreWrite(options, async () => {
    await stageScoreText(identity, "current", '{"songs":[],"counter":0}');
    await stageScoreText(identity, `history/${history}`, '{"songs":[],"_meta":{"full":true}}');
  });
}

test("one real source scope stages current/history and reads its writes before atomic publication", async () => fixture(async options => {
  await withScoreWrite(options, async () => {
    const scope = currentScoreScope(identity)!;
    await stageScoreText(identity, "current", '{ "songs": [] }\n');
    await withScoreWrite(options, async () => {
      assert.equal(currentScoreScope(identity), scope);
      await stageScoreText(identity, `history/${history}`, '{"songs":[]}');
    });
    assert.equal(await scope.reader.readRawCurrent(identity), '{ "songs": [] }\n');
    assert.deepEqual(await scope.reader.listHistory(identity), [history]);
    assert.equal(scorePublication(identity), null);
    await assert.rejects(readFile(join(options.root, `${identity}data.json`)), { code: "ENOENT" });
  });
  await withScoreRead(options, async () => {
    assert.equal(scorePublication(identity)?.sequence, 1);
    assert.equal(Object.keys(scorePublication(identity)!.files).length, 2);
  });
}));

test("concurrent real bridge read-modify-writes keep both updates", async () => fixture(async options => {
  await seed(options);
  const change = (key: string) => withScoreWrite(options, async () => {
    const current = JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity));
    current[key] = true; current.counter++;
    await stageScoreText(identity, "current", JSON.stringify(current));
    await stageScoreText(identity, `history/data_${key}.json`, JSON.stringify(current));
  });
  await Promise.all([change("first"), change("second")]);
  await withScoreRead(options, async () => {
    const current = JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity));
    assert.equal(current.first && current.second, true);
    assert.equal(current.counter, 2);
    assert.equal((await currentScoreScope(identity)!.reader.listHistory(identity)).length, 3);
    assert.equal(scorePublication(identity)?.sequence, 3);
  });
}));

test("managed readers use captured immutable objects when compatibility projections disappear", async () => fixture(async options => {
  await seed(options);
  await rm(join(options.root, `${identity}data.json`));
  await rm(join(options.root, identity, history));
  await withScoreRead(options, async () => {
    const reader = currentScoreScope(identity)!.reader;
    assert.equal(JSON.parse((await reader.readCurrent(identity)).raw).counter, 0);
    assert.equal(JSON.parse(await reader.readHistory(identity, history))._meta.full, true);
    assert.match(await reader.historyDirectoryVersion(identity), /^publication-v1:1:/);
  });
}));

test("a shared scope holds one view until all current/history work has finished", async () => fixture(async options => {
  await seed(options);
  let started = false;
  let startWriter: () => void;
  const gate = new Promise<void>(resolve => { startWriter = resolve; });
  // Register outside the read request so this is a separate AsyncLocalStorage
  // context, rather than a forbidden read-to-write upgrade in the same request.
  const writer = gate.then(() => withScoreWrite(options, async () => {
    started = true;
    await stageScoreText(identity, "current", '{"songs":[],"counter":1}');
  }));
  await withScoreRead(options, async () => {
    const before = scorePublication(identity)!.commitId;
    startWriter!();
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(started, false);
    assert.equal(scorePublication(identity)?.commitId, before);
    assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity)).counter, 0);
    assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readHistory(identity, history))._meta.full, true);
  });
  await writer;
  assert.equal(started, true);
}));

test("failed outer mutation publishes nothing and compensates only its registered DB changes", async () => fixture(async options => {
  await seed(options);
  const expected = new Error("Synthetic business failure");
  let compensated = 0;
  await assert.rejects(withScoreWrite(options, async () => {
    onScoreRollback(identity, async () => { compensated++; });
    await stageScoreText(identity, "current", '{"songs":[],"counter":2}');
    await stageScoreText(identity, "history/data_failure.json", '{"songs":[]}');
    throw expected;
  }), error => error === expected);
  assert.equal(compensated, 1);
  await withScoreRead(options, async () => {
    assert.equal(scorePublication(identity)?.sequence, 1);
    assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity)).counter, 0);
    assert.deepEqual(await currentScoreScope(identity)!.reader.listHistory(identity), [history]);
  });
}));

test("lost publication acknowledgement probes the real committed nonce and preserves DB locks", async () => fixture(async options => {
  let compensated = 0;
  const result = await withScoreWrite(options, async () => {
    onScoreRollback(identity, async () => { compensated++; });
    await stageScoreText(identity, "current", '{"songs":[]}');
    const lease = currentScoreScope(identity)!.lease;
    const publish = lease.publish;
    lease.publish = async input => { await publish(input); throw new PublicationUnavailableError(); };
    return "saved";
  });
  assert.equal(result, "saved");
  assert.equal(compensated, 0);
  await withScoreRead(options, async () => assert.equal(scorePublication(identity)?.sequence, 1));
}));

test("a failed bridge before commit is verified rolled back before DB compensation", async () => fixture(async options => {
  await seed(options);
  let compensated = 0;
  await assert.rejects(withScoreWrite(options, async () => {
    onScoreRollback(identity, async () => { compensated++; });
    await stageScoreText(identity, "current", '{"songs":[],"counter":2}');
    currentScoreScope(identity)!.lease.publish = async () => { throw new PublicationUnavailableError(); };
  }), PublicationUnavailableError);
  assert.equal(compensated, 1);
  await withScoreRead(options, async () => assert.equal(scorePublication(identity)?.sequence, 1));
}));

test("tombstones prevent legacy-file resurrection and preserve independent daily archives", async () => fixture(async options => {
  await seed(options);
  await writeFile(join(options.root, identity, "daily-ability-v1-top20.json"), '{"days":{}}');
  await withScoreWrite(options, async () => {
    await removeScoreProjection(identity, "current");
    await removeScoreProjection(identity, `history/${history}`);
    assert.equal(await currentScoreScope(identity)!.reader.currentExists(identity), false);
    assert.deepEqual(await currentScoreScope(identity)!.reader.listHistory(identity), []);
  });
  await writeFile(join(options.root, `${identity}data.json`), '{"songs":[{"high_score":999}]}');
  await withScoreRead(options, async () => {
    const reader = currentScoreScope(identity)!.reader;
    await assert.rejects(reader.readCurrent(identity), { code: "ENOENT" });
    assert.equal(await reader.currentExists(identity), false);
    assert.deepEqual(await reader.readDailyAbility(identity), { days: {} });
  });
}));

test("readers expire when their scope ends and cannot escape into a new lease", async () => fixture(async options => {
  await seed(options);
  let escaped: ScoreReadPort;
  await withScoreRead(options, async () => { escaped = currentScoreScope(identity)!.reader; });
  await assert.rejects(escaped!.readCurrent(identity), PublicationUnavailableError);
  await withScoreRead(options, async () => assert.rejects(escaped!.readCurrent(identity), PublicationUnavailableError));
}));

test("shared leases reject mutation and reader identities or source roots cannot be substituted", async () => fixture(async options => {
  await withScoreRead(options, async () => {
    await assert.rejects(withScoreWrite(options, async () => {}), PublicationUnavailableError);
    await assert.rejects(withScoreRead({ ...options, root: options.root + "-wrong" }, async () => {}), PublicationUnavailableError);
    await assert.rejects(currentScoreScope(identity)!.reader.readCurrent("other"), PublicationUnavailableError);
  });
  await seed(options);
}));

test("legacy adoption preserves exact raw bytes and malformed historical evidence", async () => fixture(async options => {
  await mkdir(join(options.root, identity));
  await writeFile(join(options.root, `${identity}data.json`), '{ "songs": [] }\n');
  await writeFile(join(options.root, identity, "data_invalid.json"), "{invalid");
  await withScoreRead(options, async () => {
    assert.equal(scorePublication(identity), null);
    assert.equal(await currentScoreScope(identity)!.reader.readRawCurrent(identity), '{ "songs": [] }\n');
  });
  await withScoreWrite(options, async () => { await stageScoreText(identity, `history/${history}`, '{"songs":[]}'); });
  await withScoreRead(options, async () => {
    assert.equal(await currentScoreScope(identity)!.reader.readRawCurrent(identity), '{ "songs": [] }\n');
    assert.equal(await currentScoreScope(identity)!.reader.readHistory(identity, "data_invalid.json"), "{invalid");
  });
}));

test("managed current JSON and object-integrity failures are explicit availability errors", async () => fixture(async options => {
  await withScoreWrite(options, async () => { await stageScoreText(identity, "current", "{invalid"); });
  await withScoreRead(options, async () => {
    await assert.rejects(currentScoreScope(identity)!.reader.readCurrent(identity), PublicationUnavailableError);
  });
  await seed(options);
  let hash = "";
  await withScoreRead(options, async () => { hash = scorePublication(identity)!.files[`history/${history}`].sha256; });
  await writeFile(join(options.root, ".taiko-publications", identity, "objects", hash), "corrupt");
  await withScoreRead(options, async () => {
    await assert.rejects(currentScoreScope(identity)!.reader.readHistory(identity, history), error => error instanceof PublicationUnavailableError && error.statusCode === 503);
  });
}));

test("source backup adopts legacy view under EX and protects current/history/daily before tombstones", async () => fixture(async options => {
  const key = "b".repeat(32);
  const raw = '{ "songs": [] }\n';
  await mkdir(join(options.root, identity));
  await writeFile(join(options.root, `${identity}data.json`), raw);
  await writeFile(join(options.root, identity, history), "invalid historical evidence");
  await writeFile(join(options.root, identity, "daily-ability-v1-top20.json"), '{"days":{}}');
  await withScoreWrite(options, async () => {
    const before = await createScoreBackup(identity, key);
    assert.equal(before.source.commitId, scorePublication(identity)?.commitId);
    assert.equal(await currentScoreScope(identity)!.reader.readRawCurrent(identity), raw);
    await removeScoreProjection(identity, "current");
    await removeScoreProjection(identity, `history/${history}`);
  });
  const path = join(options.root, ".manual_deleted", `${identity}-${key}`);
  assert.equal(await readFile(join(path, `${identity}data.json`), "utf8"), raw);
  assert.equal(await readFile(join(path, identity, history), "utf8"), "invalid historical evidence");
  assert.equal(await readFile(join(path, identity, "daily-ability-v1-top20.json"), "utf8"), '{"days":{}}');
  await withScoreRead(options, async () => assert.equal(await currentScoreScope(identity)!.reader.currentExists(identity), false));
}));

test("a stale completed backup cannot authorize deletion of a newer source generation", async () => fixture(async options => {
  const key = "d".repeat(32);
  await seed(options);
  await withScoreWrite(options, () => createScoreBackup(identity, key));
  await withScoreWrite(options, () => stageScoreText(identity, "current", '{"songs":[],"counter":1}'));
  await assert.rejects(withScoreWrite(options, () => createScoreBackup(identity, key)), PublicationUnavailableError);
  await withScoreRead(options, async () => assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity)).counter, 1));
  await assert.rejects(withScoreRead(options, () => createScoreBackup(identity, "e".repeat(32))), PublicationUnavailableError);
  await assert.rejects(withScoreWrite(options, async () => {
    await stageScoreText(identity, "current", '{"songs":[],"counter":2}');
    await createScoreBackup(identity, "e".repeat(32));
  }), PublicationUnavailableError);
  await withScoreRead(options, async () => assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity)).counter, 1));
}));

test("callback failure completes SQL compensation while the original source EX is alive", async () => fixture(async options => {
  await seed(options);
  let protectedRollback = false;
  const expected = new Error("Synthetic callback failure before publication");
  await assert.rejects(withScoreWrite(options, async () => {
    onScoreRollback(identity, async () => { protectedRollback = currentScoreScope(identity)?.mode === "write"; });
    await stageScoreText(identity, "current", '{"songs":[],"counter":2}');
    throw expected;
  }), error => error === expected);
  assert.equal(protectedRollback, true);
}));

test("rollback proof and SQL compensation retain EX against the next independent writer", async () => fixture(async options => {
  await seed(options);
  let releaseWriter: () => void;
  let writerEntered = false;
  let protectedRollback = false;
  const gate = new Promise<void>(resolve => { releaseWriter = resolve; });
  const writer = gate.then(() => withScoreWrite(options, async () => {
    writerEntered = true;
    await stageScoreText(identity, "current", '{"songs":[],"counter":3}');
  }));
  try {
    await assert.rejects(withScoreWrite(options, async () => {
      onScoreRollback(identity, async () => {
        releaseWriter!();
        await new Promise(resolve => setTimeout(resolve, 100));
        protectedRollback = !writerEntered;
      });
      await stageScoreText(identity, "current", '{"songs":[],"counter":2}');
      currentScoreScope(identity)!.lease.publish = async () => { throw new PublicationUnavailableError(); };
    }), PublicationUnavailableError);
    await writer;
    assert.equal(protectedRollback, true);
    await withScoreRead(options, async () => assert.equal(JSON.parse(await currentScoreScope(identity)!.reader.readRawCurrent(identity)).counter, 3));
  } finally { releaseWriter!(); await writer.catch(() => undefined); }
}));
