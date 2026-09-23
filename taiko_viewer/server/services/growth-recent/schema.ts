// Explicit deployment migration. Ordinary account requests never create this table.
export const GROWTH_RECENT_CURSOR_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_growth_recent_cursors (
 user_id BIGINT UNSIGNED NOT NULL,
 binding_id BIGINT UNSIGNED NOT NULL,
 cursor_token CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 observation_revision CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 observation_observed_at DATETIME(3) NOT NULL,
 algorithm_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 PRIMARY KEY (binding_id),
 KEY idx_growth_recent_cursor_owner (user_id, binding_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
