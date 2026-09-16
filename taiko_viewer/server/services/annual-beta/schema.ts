// Additive tables; entitlement reuses web_annual_summary_access.
export const BETA_TABLES = [
`CREATE TABLE IF NOT EXISTS web_beta_invites (
 id CHAR(36) PRIMARY KEY, code_hash CHAR(64) NOT NULL UNIQUE,
 cohort VARCHAR(16) NOT NULL, recruitment_source VARCHAR(16) NOT NULL DEFAULT 'other',
 expires_at DATETIME NOT NULL, max_uses INT UNSIGNED NOT NULL DEFAULT 1,
 used_count INT UNSIGNED NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 disabled_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS web_beta_participants (
 id CHAR(36) PRIMARY KEY, user_id BIGINT UNSIGNED NULL UNIQUE, invite_id CHAR(36) NULL,
 cohort VARCHAR(16) NULL, hint_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
 hint_recorded_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS web_beta_sessions (
 id CHAR(64) PRIMARY KEY, participant_id CHAR(36) NOT NULL,
 expires_at DATETIME NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_beta_session_participant(participant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS web_beta_pending (
 token_hash CHAR(64) PRIMARY KEY, session_id CHAR(64) NOT NULL, invite_id CHAR(36) NOT NULL,
 expires_at DATETIME NOT NULL, redeemed_by BIGINT UNSIGNED NULL, redeemed_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_beta_pending_session(session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS web_beta_events (
 event_id CHAR(36) PRIMARY KEY, participant_id CHAR(36) NOT NULL, user_id BIGINT UNSIGNED NULL,
 invite_id CHAR(36) NULL, session_id CHAR(64) NOT NULL, event_name VARCHAR(64) NOT NULL,
 occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), app_version VARCHAR(24) NOT NULL,
 algorithm_version VARCHAR(64) NOT NULL, locale VARCHAR(8) NOT NULL, device_class VARCHAR(16) NOT NULL,
 route VARCHAR(120) NOT NULL, metadata_json JSON NOT NULL, dedup_key VARCHAR(160) NULL,
 UNIQUE KEY uniq_beta_event_dedup(session_id,dedup_key),
 KEY idx_beta_event_participant(participant_id,occurred_at), KEY idx_beta_event_name(event_name,occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS web_beta_feedback (
 id CHAR(36) PRIMARY KEY, participant_id CHAR(36) NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
 kind VARCHAR(16) NOT NULL, category VARCHAR(32) NULL, summary_id VARCHAR(80) NULL,
 context_json JSON NOT NULL, answers_json JSON NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_beta_feedback_participant(participant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
export const BETA_MIGRATIONS = [
 "ALTER TABLE web_annual_summary_access ADD COLUMN enabled TINYINT(1) NOT NULL DEFAULT 1",
 "ALTER TABLE web_annual_summary_access ADD COLUMN invite_id CHAR(36) NULL",
 "ALTER TABLE web_annual_summary_access ADD COLUMN feature VARCHAR(64) NOT NULL DEFAULT 'annual_first_run_beta'",
 "ALTER TABLE web_beta_participants ADD COLUMN analysis_excluded TINYINT(1) NOT NULL DEFAULT 0",
 "ALTER TABLE web_beta_invites ADD COLUMN analysis_excluded TINYINT(1) NOT NULL DEFAULT 0",
 "ALTER TABLE web_annual_summary_access ADD UNIQUE KEY uniq_annual_beta_invite_owner (invite_id)"
];
