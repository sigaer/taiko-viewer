/** Existing center encrypted credential store; never contains plaintext password. */
export const HIROBA_CREDENTIAL_TABLE_SQL=`CREATE TABLE IF NOT EXISTS web_hiroba_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  taiko_no VARCHAR(25) NOT NULL,email VARCHAR(255) NOT NULL,password_enc TEXT NOT NULL,
  configured_by_qq VARCHAR(128) DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_web_hiroba_credentials_taiko_no(taiko_no),
  KEY idx_web_hiroba_credentials_configured_by_qq(configured_by_qq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
