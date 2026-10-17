// Minimal durable confirmation acknowledgement; no plaintext challenge/title,
// score payload, credentials or reusable grant.
export const BINDING_CONFIRMATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_taiko_binding_confirmations (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 verification_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 binding_id BIGINT UNSIGNED NOT NULL,
 taiko_id VARCHAR(25) NOT NULL,
 source VARCHAR(16) NOT NULL,
 challenge_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 verified_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uniq_binding_confirmation_verification (verification_id),
 KEY idx_binding_confirmation_actor (user_id,taiko_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
