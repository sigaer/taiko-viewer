export const GROWTH_MEASUREMENT_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_growth_measurements (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED NOT NULL,
 binding_id BIGINT UNSIGNED NOT NULL,
 score_revision CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 measurement_version INT UNSIGNED NOT NULL,
 algorithm_version VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 model_revision CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 rating DECIMAL(12,6) NULL,
 dimensions_json LONGTEXT NOT NULL,
 focus VARCHAR(32) NOT NULL,
 sample_count INT UNSIGNED NOT NULL,
 availability_state VARCHAR(16) NOT NULL,
 captured_at DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uniq_growth_measurement_revision (binding_id, score_revision, algorithm_version),
 KEY idx_growth_measurement_owner_range (user_id, binding_id, captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
