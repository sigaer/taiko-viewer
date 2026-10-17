// Acknowledgement evidence for SQL-only grant transactions, not score authority.
// No plaintext claim capability or recovery payload is stored here.
export const MANUAL_GRANT_RECEIPT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_manual_grant_receipts (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 taiko_id CHAR(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind VARCHAR(16) NOT NULL,
 actor_kind VARCHAR(16) NOT NULL,
 actor_key VARCHAR(191) NOT NULL,
 proof_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_manual_grant_source (taiko_id,created_at),
 KEY idx_manual_grant_claim (proof_key,actor_kind,actor_key,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
