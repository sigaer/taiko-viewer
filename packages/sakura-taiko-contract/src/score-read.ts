/** Internal read protocol. Legacy evidence is confined to the compatibility adapter. */
import type { CONTRACT_VERSION } from "./index.ts";

export type LegacyScoreRecord = {
  song_no: number;
  level: number;
  song_name?: string;
  song_name_jp?: string;
  high_score?: number;
  best_score_rank?: number;
  good_cnt?: number;
  ok_cnt?: number;
  ng_cnt?: number;
  pound_cnt?: number;
  combo_cnt?: number;
  option_flg?: unknown;
  stage_cnt?: number;
  clear_cnt?: number;
  full_combo_cnt?: number;
  dondaful_combo_cnt?: number;
  highscore_datetime?: string;
  highscore_mode?: number;
  update_datetime?: string;
  [key: string]: unknown;
};

export type LegacyScorePayload = {
  _meta?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  songs?: LegacyScoreRecord[];
  achievement?: Record<string, unknown>;
  dojo?: Record<string, unknown>;
};

export type DomainScoreSnapshot = {
  contractVersion: typeof CONTRACT_VERSION;
  current: LegacyScorePayload;
  raw: string;
  revision: string;
  capturedAt: string;
};

/** All methods are reads. No publication, caches, ownership or clock inference. */
export interface ScoreReadPort {
  readonly contractVersion: typeof CONTRACT_VERSION;
  readCurrent(taikoId: string): Promise<DomainScoreSnapshot>;
  readRawCurrent(taikoId: string): Promise<string>;
  currentExists(taikoId: string): Promise<boolean>;
  /** undefined means missing; JSON null is corrupt evidence, never missing. */
  readDailyAbility(taikoId: string): Promise<unknown>;
  listHistory(taikoId: string): Promise<string[]>;
  readHistory(taikoId: string, name: string): Promise<string>;
  historyFileVersion(taikoId: string, name: string): Promise<string>;
  historyDirectoryVersion(taikoId: string): Promise<string>;
}
