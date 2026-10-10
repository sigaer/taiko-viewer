export type LegacyScoreReadProfile = "viewer-daily-v1" | "viewer-goal-v1" | "viewer-evidence-v1" | "viewer-overview-v1" | "viewer-display-v1";
export function legacyScoreReader(profile: "viewer-overview-v1" | "viewer-display-v1"): (value: unknown) => number;
export function legacyScoreReader(profile: LegacyScoreReadProfile): (value: unknown) => number | null;
export function legacyScoreValue(value: unknown, profile: LegacyScoreReadProfile): number | null;
export function legacyCrown(record: Record<string, unknown>, profile: LegacyScoreReadProfile): number | null;
export function legacyJudgmentTotal(record: Record<string, unknown>, profile: LegacyScoreReadProfile): number | null;
export function legacyScoreInstant(value: unknown, profile: "viewer-daily-v1" | "viewer-goal-v1" | "viewer-evidence-v1"): string | null;
export function hasLegacyScoreEvidence(record: Record<string, unknown>): boolean;
