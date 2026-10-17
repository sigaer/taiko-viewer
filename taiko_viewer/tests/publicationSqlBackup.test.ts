import { prepareUserdataPublication } from "../server/infrastructure/taiko-publication/writer.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { encodeSqlRecoveryBackup, decodeSqlRecoveryBackup } from "../server/infrastructure/taiko-publication/sql-backup.ts";
import { PublicationUnavailableError } from "../server/infrastructure/taiko-publication/client.ts";

test("SQL recovery checksum survives object reordering while preserving array/string/time fields", () => {
  const original = { schema: 1, products: { goals: [{ id: 1, payload: ' {"raw":true} ', captured_at: new Date("2026-10-11T00:00:00Z") }] }, nickname: "Synthetic" };
  const raw = encodeSqlRecoveryBackup(original);
  const hash = createHash("sha256").update(raw).digest("hex");
  const parsed = JSON.parse(raw);
  const reordered = { schema: parsed.schema, nickname: parsed.nickname, products: parsed.products };
  assert.deepEqual(decodeSqlRecoveryBackup(reordered, hash), parsed);
  assert.equal(parsed.products.goals[0].payload, ' {"raw":true} ');
  assert.equal(parsed.products.goals[0].captured_at, "2026-10-11T00:00:00.000Z");
  assert.deepEqual(decodeSqlRecoveryBackup(raw, hash), parsed);
});

test("SQL recovery rejects malformed, changed and oversized data without payload diagnostics", () => {
  const raw = encodeSqlRecoveryBackup({ schema: 1, goals: [1, 2] });
  const hash = createHash("sha256").update(raw).digest("hex");
  for (const value of ['{PRIVATE_INVALID', { schema: 1, goals: [2, 1] }, null]) {
    assert.throws(() => decodeSqlRecoveryBackup(value, hash), error => error instanceof PublicationUnavailableError && !error.message.includes("PRIVATE_INVALID"));
  }
  assert.throws(() => encodeSqlRecoveryBackup({ huge: "x".repeat(8 * 1024 * 1024) }), PublicationUnavailableError);
  assert.throws(() => decodeSqlRecoveryBackup(raw, "invalid"), PublicationUnavailableError);
});

test("publication provenance rejects coercible non-string writer sources", () => {
  for (const value of [undefined, null, { toString: () => "wahlap" }]) {
    assert.throws(() => prepareUserdataPublication({ songs: [] }, value as never, 1), { statusCode: 400 });
  }
});
