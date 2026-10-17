/** Native and remote Bot adapters share one short-lived transfer proof. */
export const QQ_MIGRATION_CODE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_qq_migration_codes (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;
