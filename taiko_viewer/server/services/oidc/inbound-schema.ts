/** New tables for reverse OurTaiko → Viewer service calls. Explicit migration only. */
export const INBOUND_EXTERNAL_TABLES = [
  `CREATE TABLE IF NOT EXISTS web_inbound_external_proofs (
    service_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    viewer_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (service_id,viewer_id),
    KEY idx_inbound_proofs_expiry (expires_at),
    CONSTRAINT fk_inbound_viewer FOREIGN KEY (viewer_id) REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // No cascading FK: preserve non-sensitive pair/outcome audit after account deletion.
  `CREATE TABLE IF NOT EXISTS web_inbound_external_audit (
    attempt_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    service_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action VARCHAR(16) NOT NULL,
    viewer_id VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    ourtaiko_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
    outcome VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_inbound_audit_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
