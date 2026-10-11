// Private SQL acknowledgement; no score data, credentials or reusable grant.
export const BINDING_REVOCATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_taiko_binding_revocations (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 binding_id BIGINT UNSIGNED NOT NULL,
 taiko_id VARCHAR(64) NOT NULL,
 source VARCHAR(16) NULL,
 remaining_count INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_binding_revocation_actor (user_id,binding_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
