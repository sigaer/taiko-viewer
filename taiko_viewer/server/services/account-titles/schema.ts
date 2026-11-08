// Explicit CLI migration only; request handlers validate but never create tables.
export const ACCOUNT_TITLE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_account_titles (
  user_id BIGINT UNSIGNED NOT NULL,
  title_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  source VARCHAR(64) NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME DEFAULT NULL,
  PRIMARY KEY (user_id, title_key),
  KEY idx_web_account_titles_title (title_key, revoked_at),
  CONSTRAINT fk_web_account_titles_user FOREIGN KEY (user_id)
    REFERENCES web_user_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
