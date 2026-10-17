-- Explicit P-A migration; never imported or executed by ordinary server startup.
-- Requires separate production execution permission and a fresh verified checkpoint.
-- Run using the migration identity, not the ordinary SELECT/INSERT/UPDATE/DELETE role.
-- Preconditions: all 11 new tables absent; existing configured_by_qq is nullable
-- VARCHAR(128), utf8mb4_0900_ai_ci. No UPDATE bind or Developer v1 tables.
-- Forward widening is online INPLACE/LOCK=NONE. Test-only reverse width needs
-- COPY/LOCK=SHARED and no value >128; do not automatically down-migrate production.
-- Code rollback keeps these additive tables and widened field, preserving new data.
CREATE TABLE IF NOT EXISTS web_data_sync_receipts (
  request_id CHAR(32) NOT NULL PRIMARY KEY,
  request_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  taiko_id VARCHAR(25) NOT NULL,
  log_id BIGINT UNSIGNED DEFAULT NULL,
  log_hash CHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_web_data_sync_receipts_user(user_id),
  KEY idx_web_data_sync_receipts_source(taiko_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS taiko_source_service_grants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  developer_token_id BIGINT UNSIGNED NOT NULL,
  developer_user_id BIGINT UNSIGNED NOT NULL,
  service_name VARCHAR(64) NOT NULL,
  scopes_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  principals_json TEXT DEFAULT NULL,
  revision_nonce CHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  issued_by_user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_source_service_token(developer_token_id),
  KEY idx_source_service_user(developer_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS taiko_source_service_grant_audit (
  operation_id CHAR(32) NOT NULL PRIMARY KEY,
  developer_token_id BIGINT UNSIGNED NOT NULL,
  operator_user_id BIGINT UNSIGNED NOT NULL,
  service_name VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  scopes_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  principals_json TEXT DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_source_service_audit_token(developer_token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS taiko_bot_binding_operations (
 operation_id CHAR(32) NOT NULL PRIMARY KEY,
 actor_user_id BIGINT UNSIGNED NOT NULL,
 actor_hash CHAR(64) NOT NULL,
 grant_hash CHAR(64) NOT NULL,
 principal VARCHAR(191) NOT NULL,
 action VARCHAR(16) NOT NULL,
 intent_hash CHAR(64) NOT NULL,
 outcome_hash CHAR(64) NOT NULL,
 effect_json TEXT DEFAULT NULL,
 effect_hash CHAR(64) DEFAULT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 KEY idx_bot_binding_operation_actor(actor_user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS taiko_qq_migration_codes (
 source_principal VARCHAR(191) NOT NULL PRIMARY KEY,
 code_hash CHAR(64) NOT NULL,
 source_hash CHAR(64) NOT NULL,
 issued_at DATETIME NOT NULL,
 expires_at DATETIME NOT NULL,
 target_principal VARCHAR(191) DEFAULT NULL,
 consumed_at DATETIME DEFAULT NULL,
 effect_json TEXT DEFAULT NULL,
 effect_hash CHAR(64) DEFAULT NULL,
 KEY idx_qq_migration_expiry(expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS taiko_hiroba_binding_operations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS taiko_source_lifecycle (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS taiko_manual_grant_receipts (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 taiko_id CHAR(18) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 kind VARCHAR(16) NOT NULL,
 actor_kind VARCHAR(16) NOT NULL,
 actor_key VARCHAR(191) NOT NULL,
 proof_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_manual_grant_source (taiko_id,created_at),
 KEY idx_manual_grant_claim (proof_key,actor_kind,actor_key,kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS taiko_manual_creations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS web_taiko_binding_revocations (
 operation_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 binding_id BIGINT UNSIGNED NOT NULL,
 taiko_id VARCHAR(64) NOT NULL,
 source VARCHAR(16) NULL,
 remaining_count INT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_binding_revocation_actor (user_id,binding_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS web_taiko_binding_confirmations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE web_hiroba_credentials MODIFY COLUMN configured_by_qq VARCHAR(191) DEFAULT NULL, ALGORITHM=INPLACE, LOCK=NONE;
