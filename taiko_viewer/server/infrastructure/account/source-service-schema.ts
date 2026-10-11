/** Explicit source authority; developer quota approval alone grants no access. */
export const SOURCE_SERVICE_GRANT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_source_service_grants (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

export const SOURCE_SERVICE_GRANT_AUDIT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_source_service_grant_audit (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

export const SOURCE_SERVICE_SCOPES = [
  'source_read', 'history_read', 'wahlap_update', 'hiroba_sync',
  'hiroba_credential_status', 'hiroba_bind', 'bind_read', 'bind_write', 'bind_current',
  'bind_remove', 'bind_visibility', 'score_token_issue'
] as const;
export type SourceServiceScope = typeof SOURCE_SERVICE_SCOPES[number];
export const SOURCE_SERVICE_PRINCIPAL_MIGRATIONS = [
  'ALTER TABLE taiko_source_service_grants ADD COLUMN principals_json TEXT DEFAULT NULL AFTER sources_json',
  'ALTER TABLE taiko_source_service_grant_audit ADD COLUMN principals_json TEXT DEFAULT NULL AFTER sources_json'
];
export const validSourceIdentity = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function validateSourceServicePolicy(scopes: unknown, sources: unknown) {
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > SOURCE_SERVICE_SCOPES.length ||
    new Set(scopes).size !== scopes.length || scopes.some(value => !SOURCE_SERVICE_SCOPES.includes(value))) throw new Error('Invalid service scopes');
  if (sources !== '*' && (!Array.isArray(sources) || !sources.length || sources.length > 128 ||
    new Set(sources).size !== sources.length || sources.some(value => !validSourceIdentity(value)))) throw new Error('Invalid service sources');
  return { scopes: Object.freeze([...scopes].sort()) as readonly SourceServiceScope[],
    sources: sources === '*' ? '*' as const : Object.freeze([...sources].sort()) as readonly string[] };
}
