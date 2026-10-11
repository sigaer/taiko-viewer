export const BOT_BINDING_OPERATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS taiko_bot_binding_operations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;

export const BOT_BINDING_OPERATION_MIGRATIONS = [
 'ALTER TABLE taiko_bot_binding_operations ADD COLUMN effect_json TEXT DEFAULT NULL AFTER outcome_hash',
 'ALTER TABLE taiko_bot_binding_operations ADD COLUMN effect_hash CHAR(64) DEFAULT NULL AFTER effect_json'
];
