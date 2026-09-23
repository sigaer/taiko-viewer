import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySessionObservation,
  deriveSessionAuditCandidates,
  SESSIONIZATION_AUDIT_VERSION,
  type SessionAuditObservation
} from "../server/services/growth-session/audit.ts";

const observation = (overrides: Partial<SessionAuditObservation> = {}): SessionAuditObservation => ({
  revision: "r1",
  observedAt: "2026-09-20T10:20:00+08:00",
  source: "wahlap",
  sourceAccount: "fixture-account",
  sequence: 1,
  authoritativeObservation: true,
  authoritativeEventTime: true,
  eventTimes: ["2026-09-20 10:00:00"],
  factKeys: ["score:r1"],
  ...overrides
});

test("S1 single observation and one time cluster yields one inferred candidate", () => {
  const result = deriveSessionAuditCandidates([observation()]);
  assert.equal(classifySessionObservation(observation()), "L2");
  assert.equal(result.length, 1);
  assert.equal(result[0].evidenceLevel, "L2");
  assert.equal(result[0].sessionizationVersion, SESSIONIZATION_AUDIT_VERSION);
});

test("S2 one real round split across consecutive observations is merged", () => {
  const result = deriveSessionAuditCandidates([
    observation(),
    observation({ revision: "r2", sequence: 2, observedAt: "2026-09-20T10:45:00+08:00", eventTimes: ["2026-09-20 10:35:00"] })
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].observationRevisions, ["r1", "r2"]);
});

test("S3 one bulk observation containing two distant clusters is split", () => {
  const result = deriveSessionAuditCandidates([
    observation({ eventTimes: ["2026-09-20 10:00:00", "2026-09-20 13:00:00"] })
  ]);
  assert.equal(result.length, 2);
});

test("S4 midnight is not a hard boundary", () => {
  const result = deriveSessionAuditCandidates([
    observation({ eventTimes: ["2026-09-20 23:50:00", "2026-09-21 00:10:00"] })
  ]);
  assert.equal(result.length, 1);
});

test("S5 imported history remains L0 and cannot become a candidate", () => {
  const item = observation({ excludedReason: "import" });
  assert.equal(classifySessionObservation(item), "L0");
  assert.equal(deriveSessionAuditCandidates([item]).length, 0);
});

test("S6 manual updates remain L0", () => {
  const item = observation({ source: "manual-score", excludedReason: "manual" });
  assert.equal(classifySessionObservation(item), "L0");
  assert.equal(deriveSessionAuditCandidates([item]).length, 0);
});

test("S7 two clear same-day clusters remain separate", () => {
  const result = deriveSessionAuditCandidates([
    observation({ eventTimes: ["2026-09-20 09:00:00", "2026-09-20 09:20:00", "2026-09-20 18:00:00"] })
  ]);
  assert.equal(result.length, 2);
});

test("S8 a missing chart event time is only a recent observation", () => {
  const item = observation({ eventTimes: [] });
  assert.equal(classifySessionObservation(item), "L1");
  assert.equal(deriveSessionAuditCandidates([item]).length, 0);
});

test("S9 source changes are never merged", () => {
  const result = deriveSessionAuditCandidates([
    observation(),
    observation({ revision: "r2", source: "other-authoritative-source", eventTimes: ["2026-09-20 10:05:00"] })
  ]);
  assert.equal(result.length, 2);
});

test("S10 repair and counter regression observations break evidence", () => {
  const repair = observation({ excludedReason: "repair" });
  const regression = observation({ revision: "r2", sequence: 2, excludedReason: "counter-regression" });
  assert.equal(classifySessionObservation(repair), "L0");
  assert.equal(classifySessionObservation(regression), "L0");
  assert.equal(deriveSessionAuditCandidates([repair, regression]).length, 0);
});

test("S11 repeated improvements on one chart preserve both observation revisions", () => {
  const result = deriveSessionAuditCandidates([
    observation({ factKeys: ["chart:1:pb:100"] }),
    observation({ revision: "r2", sequence: 2, eventTimes: ["2026-09-20 10:25:00"], factKeys: ["chart:1:pb:200"] })
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].factKeys, ["chart:1:pb:100", "chart:1:pb:200"]);
});

test("S12 Goal and score facts from the same evidence window compose without redefining facts", () => {
  const input = observation({ factKeys: ["goal:g1", "score:r1"] });
  const first = deriveSessionAuditCandidates([input]);
  const second = deriveSessionAuditCandidates([input]);
  assert.deepEqual(first[0].factKeys, ["goal:g1", "score:r1"]);
  assert.equal(first[0].id, second[0].id);
});

test("authoritative source session ids produce L3 regardless of sync boundaries", () => {
  const result = deriveSessionAuditCandidates([
    observation({ sourceSessionId: "native-session", sequence: undefined }),
    observation({ revision: "r2", sourceSessionId: "native-session", sequence: undefined, eventTimes: ["2026-09-20 12:00:00"] })
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].evidenceLevel, "L3");
  assert.equal(result[0].window.precision, "source-session");
});

test("a missing source sequence prevents L2 inference", () => {
  const item = observation({ sequence: undefined });
  assert.equal(classifySessionObservation(item), "L1");
  assert.equal(deriveSessionAuditCandidates([item]).length, 0);
});
