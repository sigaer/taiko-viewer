import { createHash } from "node:crypto";

export const SESSIONIZATION_AUDIT_VERSION = "session-audit-v1-gap-45m";

export type SessionEvidenceLevel = "L0" | "L1" | "L2" | "L3";

export type SessionAuditObservation = {
  revision: string;
  observedAt: string;
  source: string;
  sourceAccount?: string;
  sequence?: number;
  sourceSessionId?: string;
  authoritativeObservation: boolean;
  authoritativeEventTime: boolean;
  eventTimes: string[];
  factKeys?: string[];
  excludedReason?: "import" | "manual" | "repair" | "content-edit" | "counter-regression" | "unknown-source";
};

export type SessionAuditCandidate = {
  id: string;
  evidenceLevel: "L2" | "L3";
  source: string;
  sourceAccount: string;
  window: {
    from: string;
    to: string;
    precision: "source-session" | "event-cluster";
  };
  observationRevisions: string[];
  factKeys: string[];
  sessionizationVersion: string;
};

type NormalizedObservation = SessionAuditObservation & {
  parsedEvents: number[];
  parsedObservedAt: number;
};

const normalizeInstant = (value: string) => {
  const text = String(value || "").trim();
  if (!text) return Number.NaN;
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(" ", "T")}+08:00`
    : text;
  return Date.parse(normalized);
};

const stableCandidateId = (candidate: Omit<SessionAuditCandidate, "id">) =>
  createHash("sha256")
    .update([
      candidate.sessionizationVersion,
      candidate.evidenceLevel,
      candidate.source,
      candidate.sourceAccount,
      candidate.window.from,
      candidate.window.to,
      ...candidate.observationRevisions
    ].join("\n"))
    .digest("hex")
    .slice(0, 24);

export function classifySessionObservation(observation: SessionAuditObservation): SessionEvidenceLevel {
  if (observation.excludedReason) return "L0";
  if (!observation.authoritativeObservation) return "L0";
  if (observation.sourceSessionId && observation.sourceAccount) return "L3";
  if (
    !observation.authoritativeEventTime ||
    !observation.sourceAccount ||
    !Number.isInteger(observation.sequence) ||
    !observation.eventTimes.length ||
    observation.eventTimes.some(value => !Number.isFinite(normalizeInstant(value)))
  ) return "L1";
  return "L2";
}

const normalizeObservation = (observation: SessionAuditObservation): NormalizedObservation => ({
  ...observation,
  parsedEvents: observation.eventTimes.map(normalizeInstant).filter(Number.isFinite).sort((left, right) => left - right),
  parsedObservedAt: normalizeInstant(observation.observedAt)
});

const buildCandidate = (
  level: "L2" | "L3",
  source: string,
  sourceAccount: string,
  from: number,
  to: number,
  observations: NormalizedObservation[],
  sessionizationVersion: string
): SessionAuditCandidate => {
  const observationRevisions = [...new Set(observations.map(item => item.revision))].sort();
  const factKeys = [...new Set(observations.flatMap(item => item.factKeys || []))].sort();
  const withoutId: Omit<SessionAuditCandidate, "id"> = {
    evidenceLevel: level,
    source,
    sourceAccount,
    window: {
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      precision: level === "L3" ? "source-session" : "event-cluster"
    },
    observationRevisions,
    factKeys,
    sessionizationVersion
  };
  return { id: stableCandidateId(withoutId), ...withoutId };
};

/**
 * Audit-only prototype. Product code must not present these candidates as an
 * arcade session unless the evidence level is L3.
 */
export function deriveSessionAuditCandidates(
  input: SessionAuditObservation[],
  gapMinutes = 45
): SessionAuditCandidate[] {
  const observations = input.map(normalizeObservation);
  const candidates: SessionAuditCandidate[] = [];
  const inferredVersion = gapMinutes === 45
    ? SESSIONIZATION_AUDIT_VERSION
    : `session-audit-v1-gap-${Math.max(1, gapMinutes)}m`;

  const authoritative = new Map<string, NormalizedObservation[]>();
  for (const observation of observations) {
    if (classifySessionObservation(observation) !== "L3") continue;
    const key = `${observation.source}\u0000${observation.sourceAccount || ""}\u0000${observation.sourceSessionId}`;
    const bucket = authoritative.get(key) || [];
    bucket.push(observation);
    authoritative.set(key, bucket);
  }
  for (const bucket of authoritative.values()) {
    const times = bucket.flatMap(item => item.parsedEvents).filter(Number.isFinite);
    const observed = bucket.map(item => item.parsedObservedAt).filter(Number.isFinite);
    const from = Math.min(...(times.length ? times : observed));
    const to = Math.max(...(times.length ? times : observed));
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    candidates.push(buildCandidate("L3", bucket[0].source, bucket[0].sourceAccount || "", from, to, bucket, "session-audit-v1-native"));
  }

  const inferredGroups = new Map<string, NormalizedObservation[]>();
  for (const observation of observations) {
    if (classifySessionObservation(observation) !== "L2") continue;
    const key = `${observation.source}\u0000${observation.sourceAccount}`;
    const bucket = inferredGroups.get(key) || [];
    bucket.push(observation);
    inferredGroups.set(key, bucket);
  }

  const gapMs = Math.max(1, gapMinutes) * 60_000;
  for (const bucket of inferredGroups.values()) {
    const events = bucket
      .flatMap(observation => observation.parsedEvents.map(epoch => ({ epoch, observation })))
      .sort((left, right) => left.epoch - right.epoch || left.observation.revision.localeCompare(right.observation.revision));
    let cluster: typeof events = [];
    const flush = () => {
      if (!cluster.length) return;
      const members = [...new Set(cluster.map(item => item.observation))];
      candidates.push(buildCandidate(
        "L2",
        members[0].source,
        members[0].sourceAccount || "",
        cluster[0].epoch,
        cluster.at(-1)!.epoch,
        members,
        inferredVersion
      ));
      cluster = [];
    };
    for (const event of events) {
      const previous = cluster.at(-1);
      const sameObservation = previous?.observation.revision === event.observation.revision;
      const sequenceContinuous = !previous || sameObservation || event.observation.sequence === previous.observation.sequence! + 1;
      if (previous && (event.epoch - previous.epoch > gapMs || !sequenceContinuous)) flush();
      cluster.push(event);
    }
    flush();
  }

  return candidates.sort((left, right) =>
    left.window.from.localeCompare(right.window.from) ||
    left.source.localeCompare(right.source) ||
    left.id.localeCompare(right.id)
  );
}
