/**
 * Exact daily active accounts (one row per Beijing calendar day and account).
 *
 * Explicit migration only (scripts/migrate_user_activity_schema.ts); deliberately
 * excluded from CREATE_TABLES so the read-only runtime schema validation never
 * requires it. Writers and readers treat a missing table as "not tracked yet".
 * No foreign key (like web_player_goals): the isolated test DB account has no
 * REFERENCES privilege, and a past day's count stays valid after an account is gone.
 */
export const USER_DAILY_ACTIVITY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_user_daily_activity (
    day DATE NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, user_id),
    KEY idx_web_user_daily_activity_user_id (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

/**
 * One-time seed from session last_seen_at. MySQL sessions run in Beijing time
 * (docs/admin-dashboard-timezone.md), so DATE(last_seen_at) is the Beijing day.
 * Yields true but partial pairs for past days; only runs on an empty table.
 */
export const USER_DAILY_ACTIVITY_SEED_SQL = `INSERT IGNORE INTO web_user_daily_activity (day, user_id, first_seen_at)
  SELECT DATE(last_seen_at) AS day, user_id, MIN(last_seen_at) AS first_seen_at
  FROM web_user_sessions
  GROUP BY DATE(last_seen_at), user_id`;

/**
 * Daily qualified visits from the client beacon (POST /api/metrics/visit).
 * Keys are HMACs of the device id / IP with the traffic salt; no plain device
 * id, IP or UA is stored. Retention: 90 days (purged opportunistically).
 * Explicit migration only, like web_user_daily_activity.
 */
export const DAILY_VISITORS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS web_daily_visitors (
    day DATE NOT NULL,
    visitor_key CHAR(64) NOT NULL,
    ip_key CHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    is_suspect TINYINT NOT NULL DEFAULT 0,
    first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (day, visitor_key),
    KEY idx_web_daily_visitors_ip (day, ip_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

export const DAILY_VISITORS_RETENTION_DAYS = 90;
