import test from "node:test";
import assert from "node:assert/strict";
import { countAdminUsers, readAdminUserCounts, type UserCountSnapshot } from "../server/utils/admin/user-counts.ts";

const snapshot = (): UserCountSnapshot => ({
  viewerUsers: ["1", "2", "3", "4", "5"].map(id => ({ id })),
  viewerBindings: [
    { user_id: "1", taiko_id: "10001", source: "wahlap" },
    { user_id: "2", taiko_id: "10002", source: "wahlap" },
    { user_id: "4", taiko_id: "10002", source: "wahlap" },
    { user_id: "5", taiko_id: "10003", source: "wahlap" },
    { user_id: "5", taiko_id: "10004", source: "wahlap" }
  ],
  botBindings: [
    { qq: "qq_official:AbC", id: "10001", source: "wahlap" },
    { qq: "onebot_v11:12345", id: "10001", source: "wahlap" },
    { qq: "67890", id: "10005", source: "wahlap" },
    { qq: "qq_official:AbC", id: "001234567890", source: "hiroba" },
    { qq: "onebot_v11:12345", id: "001234567890", source: "hiroba" }
  ]
});

const assertPartitions = (counts: ReturnType<typeof countAdminUsers>) => {
  assert.equal(counts.totalUsers, counts.viewerOnlyUsers + counts.linkedUsers + counts.botOnlyUsers);
  assert.equal(counts.totalUsers, counts.cnUsers + counts.overseasUsers + counts.viewerOnlyOverseasUsers + counts.manualUsers);
  assert.equal(counts.totalUsers, counts.taikoBindings + counts.viewerOnlyUnboundUsers);
  assert.equal(counts.viewerOnlyUsers, counts.viewerOnlyBoundUsers + counts.viewerOnlyUnboundUsers);
  assert.equal(counts.botOnlyUsers, counts.botOnlyCnUsers + counts.botOnlyOverseasUsers + counts.botOnlyManualUsers);
  assert.equal(counts.botUsers, counts.linkedUsers + counts.botOnlyUsers);
};

test("game IDs deduplicate across Viewer, official Bot and QQ; every breakdown reconciles", () => {
  const counts = countAdminUsers(snapshot());
  assert.deepEqual(counts, {
    totalUsers: 7, viewerUsers: 5, botUsers: 3,
    viewerOnlyUsers: 4, viewerOnlyBoundUsers: 3, viewerOnlyUnboundUsers: 1,
    viewerOnlyCnUsers: 3, viewerOnlyOverseasUsers: 0, viewerOnlyManualUsers: 0,
    linkedUsers: 1, botOnlyUsers: 2, botOnlyCnUsers: 1, botOnlyOverseasUsers: 1,
    botOnlyManualUsers: 0, viewerOverseasUsers: 0, viewerManualUsers: 0, botManualUsers: 0, manualUsers: 0,
    cnUsers: 6, overseasUsers: 1, officialBotUsers: 2, qqBotUsers: 3,
    taikoBindings: 6, wahlapBindings: 5, hirobaBindings: 1
  });
  assertPartitions(counts);
});

test("all retained IDs count; selecting another slot or repeating a record does not change totals", () => {
  const input = snapshot();
  const before = countAdminUsers(input);
  input.botBindings = input.botBindings.flatMap(row => [{ ...row }, { ...row }]).reverse();
  input.viewerBindings.reverse();
  input.viewerUsers.push({ id: "1" });
  assert.deepEqual(countAdminUsers(input), before);
  input.botBindings.push({ qq: "qq_official:AbC", id: "10006", source: "wahlap" });
  assert.equal(countAdminUsers(input).totalUsers, before.totalUsers + 1);
});

test("different platform identities using the same game ID do not inflate population", () => {
  const input = snapshot();
  input.botBindings.push({ qq: "qq_official:OtherPerson", id: "10001", source: "wahlap" });
  input.botBindings.push({ qq: "onebot_v11:67890", id: "10005", source: "wahlap" });
  assert.deepEqual(countAdminUsers(input), countAdminUsers(snapshot()));
});

test("a Viewer owner with both shared and private IDs contributes each ID to its own segment", () => {
  const input = snapshot();
  input.viewerBindings.push({ user_id: "1", taiko_id: "10007", source: "wahlap" });
  const counts = countAdminUsers(input);
  assert.equal(counts.linkedUsers, 1);
  assert.equal(counts.viewerOnlyBoundUsers, 4);
  assert.equal(counts.viewerOnlyUnboundUsers, 1);
  assertPartitions(counts);
});

test("unbound Viewer accounts count individually, including all-Viewer and empty populations", () => {
  const empty = { viewerUsers: [], viewerBindings: [], botBindings: [] };
  assert.equal(countAdminUsers(empty).totalUsers, 0);
  const counts = countAdminUsers({ ...empty, viewerUsers: [{ id: "1" }, { id: "2" }] });
  assert.equal(counts.totalUsers, 2);
  assert.equal(counts.viewerOnlyUnboundUsers, 2);
  assert.equal(counts.cnUsers, 2);
  assertPartitions(counts);
});

test("historical Viewer overseas and manual IDs remain separate from CN and Bot overseas", () => {
  const input: UserCountSnapshot = {
    viewerUsers: [{ id: "1" }, { id: "2" }],
    viewerBindings: [
      { user_id: "1", taiko_id: "001234567890", source: "hiroba" },
      { user_id: "2", taiko_id: "980000000000000001", source: "manual" }
    ],
    botBindings: [{ qq: "onebot_v11:12345", id: "980000000000000002", source: "manual" }]
  };
  const counts = countAdminUsers(input);
  assert.equal(counts.totalUsers, 3);
  assert.equal(counts.viewerOnlyUnboundUsers, 0);
  assert.equal(counts.botUsers, 1);
  assert.equal(counts.overseasUsers, 0);
  assert.equal(counts.viewerOverseasUsers, 1);
  assert.equal(counts.viewerOnlyOverseasUsers, 1);
  assert.equal(counts.manualUsers, 2);
  assert.equal(counts.cnUsers, 0);
  assertPartitions(counts);
});

test("historical overseas and manual IDs shared with Bot count once in website plus Bot", () => {
  const input: UserCountSnapshot = {
    viewerUsers: [{ id: "1" }],
    viewerBindings: [
      { user_id: "1", taiko_id: "001234567890", source: "hiroba" },
      { user_id: "1", taiko_id: "980000000000000001", source: "manual" }
    ],
    botBindings: [
      { qq: "qq_official:AbC", id: "001234567890", source: "hiroba" },
      { qq: "12345", id: "980000000000000001", source: "manual" },
      { qq: "qq_official:AbC", id: "980000000000000001", source: "manual" }
    ]
  };
  const counts = countAdminUsers(input);
  assert.equal(counts.totalUsers, 2);
  assert.equal(counts.linkedUsers, 2);
  assert.equal(counts.viewerOnlyUsers, 0);
  assert.equal(counts.botOnlyUsers, 0);
  assert.equal(counts.overseasUsers, 1);
  assert.equal(counts.viewerOverseasUsers, 1);
  assert.equal(counts.manualUsers, 1);
  assert.equal(counts.viewerManualUsers, 1);
  assert.equal(counts.botManualUsers, 1);
  assertPartitions(counts);
});

test("orphan, blank, malformed, unknown-source and unsupported Bot channel records do not count", () => {
  const input = snapshot();
  input.viewerBindings.push({ user_id: "missing", taiko_id: "10007", source: "wahlap" });
  input.botBindings.push(
    { qq: "onebot_v11:12345", id: " ", source: "wahlap" },
    { qq: "onebot_v11:12345", id: "invalid", source: "wahlap" },
    { qq: "other:12345", id: "10007", source: "wahlap" },
    { qq: "onebot_v11:12345", id: "10007", source: "unknown" },
    { qq: "onebot_v11:12345", id: "10007", source: "manual" }
  );
  assert.deepEqual(countAdminUsers(input), countAdminUsers(snapshot()));
});

test("invalid historical Viewer bindings do not become IDs or hide unbound website users", () => {
  const input = snapshot();
  input.viewerBindings.push(
    { user_id: "3", taiko_id: "not-an-id", source: "wahlap" },
    { user_id: "1", taiko_id: "bad", source: "wahlap" }
  );
  assert.deepEqual(countAdminUsers(input), countAdminUsers(snapshot()));
});

test("legacy source inference preserves overseas leading zeroes and trims ID whitespace", () => {
  const input = snapshot();
  input.botBindings = input.botBindings.map(row => ({ ...row, source: null, id: ` ${row.id} ` }));
  assert.deepEqual(countAdminUsers(input), countAdminUsers(snapshot()));
});

test("CN and overseas namespaces cannot collide even if an imported record reuses the same digits", () => {
  const input = snapshot();
  input.botBindings.push({ qq: "qq_official:AbC", id: "10001", source: "hiroba" });
  const counts = countAdminUsers(input);
  assert.equal(counts.totalUsers, 8);
  assert.equal(counts.overseasUsers, 2);
  assert.equal(counts.linkedUsers, 1);
  assertPartitions(counts);
});

test("population partitions hold as IDs acquire and lose platform records", () => {
  const input = snapshot();
  for (let i = 0; i < 32; i++) {
    const rows = input.botBindings.filter((_, index) => i & (1 << index));
    assertPartitions(countAdminUsers({ ...input, botBindings: rows }));
  }
});

test("reader uses all bindings in one read-only snapshot and always releases its connection", async () => {
  for (const fail of [false, true]) {
    const events: string[] = [];
    const data = snapshot();
    const connection = {
      async query(sql: string) {
        events.push(sql);
        assert.doesNotMatch(sql, /is_current|web_user_qq_bindings|web_hiroba_credentials/);
        if (sql.includes("FROM web_user_accounts")) return [data.viewerUsers];
        if (sql.includes("FROM web_taiko_bindings")) return [data.viewerBindings];
        if (sql.includes("FROM bind")) {
          if (fail) throw new Error("read failed");
          return [data.botBindings];
        }
        return [[]];
      },
      async commit() { events.push("commit"); },
      async rollback() { events.push("rollback"); },
      release() { events.push("release"); }
    };
    const db = { getConnection: async () => connection } as unknown as Parameters<typeof readAdminUserCounts>[0];
    if (fail) await assert.rejects(readAdminUserCounts(db), /read failed/);
    else assert.deepEqual(await readAdminUserCounts(db), countAdminUsers(data));
    assert.match(events[1], /WITH CONSISTENT SNAPSHOT, READ ONLY/);
    assert.deepEqual(events.slice(-2), [fail ? "rollback" : "commit", "release"]);
  }
});
