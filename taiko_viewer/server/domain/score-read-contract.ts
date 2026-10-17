/** Compatibility re-export; read protocol is owned by the domain Contract. */
export const SCORE_READ_VERSION = "1.0" as const;
export type { LegacyScoreRecord, LegacyScorePayload, DomainScoreSnapshot, ScoreReadPort } from "@sakura-taiko/contract/score-read";
