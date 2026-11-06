/** Explicit migration only; deliberately excluded from startup CREATE_TABLES. */
export const OIDC_TABLES = [
  `CREATE TABLE IF NOT EXISTS web_external_identities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    provider_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issuer VARBINARY(512) NOT NULL,
    subject VARBINARY(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    remote_link_status VARCHAR(24) NOT NULL DEFAULT 'not_requested',
    remote_link_operation_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_external_identity (issuer, subject),
    UNIQUE KEY uniq_external_user_issuer (user_id, issuer),
    UNIQUE KEY uniq_external_remote_operation (remote_link_operation_id),
    CONSTRAINT fk_external_user FOREIGN KEY (user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_oidc_transactions (
    state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    browser_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_id VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    config_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    nonce VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    verifier VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    purpose VARCHAR(8) NOT NULL,
    target_user_id BIGINT UNSIGNED DEFAULT NULL,
    recovery_subject VARBINARY(255) DEFAULT NULL,
    recovery_external_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
    return_path VARCHAR(1024) NOT NULL,
    locale VARCHAR(2) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_oidc_expiry (expires_at),
    CONSTRAINT fk_oidc_target FOREIGN KEY (target_user_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Intentionally no cascading FK: audit evidence must survive account removal.
  // The immutable pair is persisted before any remote write; never store tokens.
  `CREATE TABLE IF NOT EXISTS web_oidc_remote_link_attempts (
    attempt_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    operation_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    issuer VARBINARY(512) NOT NULL,
    subject VARBINARY(255) NOT NULL,
    service_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    external_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    outcome VARCHAR(16) NOT NULL,
    error_code VARCHAR(32) DEFAULT NULL,
    retry_at DATETIME DEFAULT NULL,
    lease_until DATETIME NOT NULL,
    remote_linked_at VARCHAR(40) DEFAULT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_remote_operation (operation_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
