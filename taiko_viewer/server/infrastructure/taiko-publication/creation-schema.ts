// Private Infrastructure creation journal. Payload is a bounded blank profile,
// never an authority for scores, credentials or existing account ownership.
export const MANUAL_CREATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_manual_creations (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 taiko_id CHAR(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 actor_kind VARCHAR(16) NOT NULL,
 actor_key VARCHAR(191) NOT NULL,
 nickname VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'pending',
 initial_current MEDIUMTEXT NOT NULL,
 current_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 prior_current VARCHAR(64) NULL,
 pending_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 last_attempt_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 UNIQUE KEY uniq_manual_creation_identity (taiko_id),
 UNIQUE KEY uniq_manual_creation_pending (pending_key),
 KEY idx_manual_creation_due (status,last_attempt_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
