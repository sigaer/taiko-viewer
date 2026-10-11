export const ACCOUNT_SYNC_RECEIPT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_data_sync_receipts (
  request_id CHAR(32) NOT NULL PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  taiko_id VARCHAR(25) NOT NULL,
  log_id BIGINT UNSIGNED DEFAULT NULL,
  log_hash CHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_web_data_sync_receipts_user(user_id),
  KEY idx_web_data_sync_receipts_source(taiko_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
