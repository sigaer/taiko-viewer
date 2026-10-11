// Infrastructure outbox and private recovery receipt; not a score authority.
export const SOURCE_LIFECYCLE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_source_lifecycle (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 taiko_id CHAR(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind VARCHAR(32) NOT NULL,
 actor_kind VARCHAR(16) NOT NULL,
 actor_key VARCHAR(191) NOT NULL,
 backup_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_commit_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 source_sequence BIGINT UNSIGNED NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'pending',
 published_commit_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
 sql_backup JSON NOT NULL,
 sql_backup_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 last_attempt_at DATETIME(3) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 KEY idx_source_lifecycle_identity (taiko_id,created_at),
 KEY idx_source_lifecycle_pending (status,last_attempt_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
