import test from "node:test";
import assert from "node:assert/strict";
import { countAdminUsers, readAdminUserCounts, type UserIdentitySnapshot } from "../server/utils/admin/user-counts.ts";

const snapshot = (): UserIdentitySnapshot => ({
  viewerUsers: [{ id: "1" }, { id: "2" }],
  botUsers: [{ identity_key: "onebot_v11:12345" }, { identity_key: "qq_official:AbC" }],
  qqLinks: [{ user_id: "1", qq_number: "12345", status: "active", verified_at: "2026-11-25 00:00:00" }]
});

test("verified cross-platform identity counts once; segments partition users", () => {
  assert.deepEqual(countAdminUsers(snapshot()), {
    totalUsers: 3, viewerUsers: 2, botUsers: 2,
    viewerOnlyUsers: 1, botOnlyUsers: 1, linkedUsers: 1
  });
});

test("multiple game slots and switching current game do not change user counts", () => {
  const input = snapshot();
  const before = countAdminUsers(input);
  // Each retained bind slot produces a principal row. Adding another game or
  // selecting a different slot must preserve the same user population.
  input.botUsers.push({ identity_key: "onebot_v11:12345" }, { identity_key: "qq_official:AbC" });
  input.botUsers.reverse();
  assert.deepEqual(countAdminUsers(input), before);
});

test("historical bare QQ and OneBot collapse, official OpenIDs remain case-sensitive", () => {
  const input = snapshot();
  input.botUsers.push({ identity_key: "12345" }, { identity_key: "qq_official:abc" });
  assert.equal(countAdminUsers(input).totalUsers, 4);
  assert.equal(countAdminUsers(input).botUsers, 3);
});

test("pending, removed, unverified, missing-owner and non-Bot QQ links do not merge users", () => {
  for (const change of [
    { status: "pending" }, { status: "removed" }, { verified_at: null },
    { user_id: "999" }, { qq_number: "99999" }
  ]) {
    const input = snapshot();
    Object.assign(input.qqLinks[0], change);
    assert.equal(countAdminUsers(input).totalUsers, 4);
    assert.equal(countAdminUsers(input).linkedUsers, 0);
  }
});

test("shared games cannot merge distinct users without a verified identity link", () => {
  const input = snapshot();
  input.qqLinks = [];
  // Game IDs are deliberately absent from the identity projection.
  assert.equal(countAdminUsers(input).totalUsers, 4);
});

test("empty populations, duplicate rows and blank Bot principals", () => {
  assert.equal(countAdminUsers({ viewerUsers: [], botUsers: [], qqLinks: [] }).totalUsers, 0);
  const input = snapshot();
  input.viewerUsers.push({ id: "1" });
  input.qqLinks.push({ ...input.qqLinks[0] });
  input.botUsers.push({ identity_key: " " });
  assert.equal(countAdminUsers(input).totalUsers, 3);
});

test("contradictory identity proof fails instead of silently undercounting", () => {
  const input = snapshot();
  input.qqLinks.push({ ...input.qqLinks[0], user_id: "2" });
  assert.throws(() => countAdminUsers(input), /Conflicting verified user identities/);
});

test("reader closes its read-only snapshot and releases the connection on success or failure", async () => {
  for (const fail of [false, true]) {
    const events: string[] = [];
    const data = snapshot();
    const connection = {
      async query(sql: string) {
        events.push(sql);
        if (sql.includes("FROM web_user_accounts")) return [data.viewerUsers];
        if (sql.includes("FROM bind")) {
          if (fail) throw new Error("read failed");
          return [data.botUsers];
        }
        if (sql.includes("FROM web_user_qq_bindings")) return [data.qqLinks];
        return [[]];
      },
      async commit() { events.push("commit"); },
      async rollback() { events.push("rollback"); },
      release() { events.push("release"); }
    };
    const db = { getConnection: async () => connection } as unknown as Parameters<typeof readAdminUserCounts>[0];
    if (fail) await assert.rejects(readAdminUserCounts(db), /read failed/);
    else assert.equal((await readAdminUserCounts(db)).totalUsers, 3);
    assert.match(events[1], /WITH CONSISTENT SNAPSHOT, READ ONLY/);
    assert.deepEqual(events.slice(-2), [fail ? "rollback" : "commit", "release"]);
  }
});
