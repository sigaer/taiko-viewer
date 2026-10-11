/** Existing center encrypted credential store; never contains plaintext password. */
export const HIROBA_CREDENTIAL_TABLE_SQL=`CREATE TABLE IF NOT EXISTS web_hiroba_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  taiko_no VARCHAR(25) NOT NULL,email VARCHAR(255) NOT NULL,password_enc TEXT NOT NULL,
  configured_by_qq VARCHAR(191) DEFAULT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_web_hiroba_credentials_taiko_no(taiko_no),
  KEY idx_web_hiroba_credentials_configured_by_qq(configured_by_qq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
export const HIROBA_CREDENTIAL_MIGRATIONS=[
 'ALTER TABLE web_hiroba_credentials MODIFY COLUMN configured_by_qq VARCHAR(191) DEFAULT NULL'
];
export const HIROBA_BINDING_OPERATION_TABLE_SQL=`CREATE TABLE IF NOT EXISTS taiko_hiroba_binding_operations (
 operation_id CHAR(32) NOT NULL PRIMARY KEY,
 actor_user_id BIGINT UNSIGNED NOT NULL,
 actor_hash CHAR(64) NOT NULL,
 grant_hash CHAR(64) NOT NULL,
 intent_hash CHAR(64) NOT NULL,
 source_ids_json TEXT NOT NULL,
 credential_hash CHAR(64) NOT NULL,
 outcome_hash CHAR(64) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_hiroba_binding_operation_actor(actor_user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;
