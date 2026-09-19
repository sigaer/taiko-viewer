import test from "node:test";
import assert from "node:assert/strict";
import { GROWTH_ALGORITHM_VERSION } from "../server/services/growth-history/constants.ts";
import { GROWTH_MEASUREMENT_TABLE_SQL } from "../server/services/growth-history/schema.ts";
import { measurementDimensions, measurementFocus, upsertGrowthMeasurement } from "../server/services/growth-history/measurements.ts";
import { buildPlayerGrowthState, GROWTH_DIMENSION_ORDER } from "../utils/playerGrowth.ts";

const state = (style: "ready" | "limited" | "balanced" | "missing") => buildPlayerGrowthState(
  GROWTH_DIMENSION_ORDER.filter(key => style !== "missing" || key !== "complex").map(key => ({ key, value: style === "balanced" ? 10 : key === "accuracy_power" ? 9 : 10 })),
  style === "limited" ? 2 : 30,
  "FULL_HISTORY",
  10.28
);

test("measurement focus preserves ready, limited, balanced and missing dimensions", () => {
  assert.equal(measurementFocus(state("ready")), "accuracy_power");
  assert.equal(measurementFocus(state("limited")), "limited");
  assert.equal(measurementFocus(state("balanced")), "balanced");
  assert.equal(measurementDimensions(state("missing")).complex, 0);
  assert.equal(measurementDimensions(state("missing"), state("missing").skills.filter(item => item.key !== "complex")).complex, null);
});

test("measurement upsert is owner-scoped and stable per revision", async () => {
  const keys = new Set<string>();
  const calls: unknown[][] = [];
  const db = { execute: async (_sql: string, values: unknown[]) => {
    calls.push(values);
    const key = `${values[12]}:${values[1]}:${values[3]}`;
    const created = !keys.has(key); keys.add(key);
    return [{ affectedRows: created ? 1 : 0 }];
  } } as any;
  const input = { userId: 7, bindingId: 9, scoreRevision: "a".repeat(64), capturedAt: "2026-09-19T01:02:03.000Z", modelRevision: "b".repeat(64), playerState: state("ready") };
  assert.deepEqual(await upsertGrowthMeasurement(db, input), { created: true });
  assert.deepEqual(await upsertGrowthMeasurement(db, input), { created: false });
  assert.deepEqual(await upsertGrowthMeasurement(db, { ...input, scoreRevision: "c".repeat(64) }), { created: true });
  assert.equal(calls[0][3], GROWTH_ALGORITHM_VERSION);
  assert.equal(calls[0][11], 9);
  assert.equal(calls[0][12], 7);
});

test("measurement schema has versioned uniqueness and no references", () => {
  assert.match(GROWTH_MEASUREMENT_TABLE_SQL, /UNIQUE KEY[^\n]+\(binding_id, score_revision, algorithm_version\)/);
  assert.doesNotMatch(GROWTH_MEASUREMENT_TABLE_SQL, /FOREIGN KEY|REFERENCES/i);
});
