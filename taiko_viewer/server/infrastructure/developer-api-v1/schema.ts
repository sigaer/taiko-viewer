/** Additive platform authorization metadata. No score Writer or domain tables. */
export const DEVELOPER_API_V1_TABLES = [
 `CREATE TABLE IF NOT EXISTS web_developer_api_clients (
  client_id CHAR(36) NOT NULL PRIMARY KEY, application_id BIGINT UNSIGNED NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL, display_name VARCHAR(80) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uniq_api_client_application(application_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
 `CREATE TABLE IF NOT EXISTS web_developer_api_resources (
  player_id CHAR(36) NOT NULL PRIMARY KEY, binding_id BIGINT UNSIGNED NOT NULL,
  UNIQUE KEY uniq_api_resource_binding(binding_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
 `CREATE TABLE IF NOT EXISTS web_developer_resource_grants (
  grant_id CHAR(32) NOT NULL PRIMARY KEY, revision CHAR(32) NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL, binding_id BIGINT UNSIGNED NOT NULL,
  player_id CHAR(36) NOT NULL, client_id CHAR(36) NOT NULL, audience VARCHAR(64) NOT NULL,
  taiko_id VARCHAR(25) NOT NULL, source VARCHAR(16) NOT NULL, manual_account_id VARCHAR(25) DEFAULT NULL,
  scopes_json TEXT NOT NULL, consent_version VARCHAR(32) NOT NULL,
  consented_at DATETIME(3) NOT NULL, issued_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL, revoked_at DATETIME(3) DEFAULT NULL,
  UNIQUE KEY uniq_api_grant_binding_client(owner_user_id,binding_id,client_id),
  KEY idx_api_grant_player_client(player_id,client_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`,
 `CREATE TABLE IF NOT EXISTS web_developer_resource_grant_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, grant_id CHAR(32) NOT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL, binding_id BIGINT UNSIGNED NOT NULL, client_id CHAR(36) NOT NULL,
  action VARCHAR(16) NOT NULL, scopes_json TEXT NOT NULL, consent_version VARCHAR(32) NOT NULL,
  recorded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), KEY idx_api_grant_event(grant_id,id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`
];
