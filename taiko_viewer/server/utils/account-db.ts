import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

const getDbConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  return {
    host: String(runtimeConfig.dbHost || process.env.TAIKO_DB_HOST || "127.0.0.1"),
    port: Number(runtimeConfig.dbPort || process.env.TAIKO_DB_PORT || 3306),
    user: String(runtimeConfig.dbUser || process.env.TAIKO_DB_USER || "root"),
    password: String(runtimeConfig.dbPassword || process.env.TAIKO_DB_PASSWORD || "wtf025366"),
    database: String(runtimeConfig.dbName || process.env.TAIKO_DB_NAME || "taiko")
  };
};

export const getAccountDb = () => {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: 10,
      namedPlaceholders: true,
      charset: "utf8mb4"
    });
  }
  return pool;
};

const CREATE_TABLES = [
  `CREATE TABLE IF NOT EXISTS web_user_accounts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(1024) DEFAULT NULL,
    avatar_key VARCHAR(512) DEFAULT NULL,
    email_verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_user_accounts_username (username),
    UNIQUE KEY uniq_web_user_accounts_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_user_sessions (
    session_token CHAR(64) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_web_user_sessions_user_id (user_id),
    KEY idx_web_user_sessions_expires_at (expires_at),
    CONSTRAINT fk_web_user_sessions_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_email_verifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    purpose VARCHAR(32) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_web_email_verifications_email_purpose (email, purpose),
    KEY idx_web_email_verifications_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_password_resets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_web_password_resets_email (email),
    KEY idx_web_password_resets_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_taiko_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL,
    is_current TINYINT(1) NOT NULL DEFAULT 0,
    verified_title VARCHAR(255) DEFAULT NULL,
    verified_titleplate_id INT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_bindings_user_id_taiko_id (user_id, taiko_id),
    UNIQUE KEY uniq_web_taiko_bindings_taiko_id (taiko_id),
    KEY idx_web_taiko_bindings_user_id_current (user_id, is_current),
    CONSTRAINT fk_web_taiko_bindings_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_taiko_binding_verifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL,
    original_title VARCHAR(255) NOT NULL,
    original_titleplate_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_binding_verifications_user_id (user_id),
    KEY idx_web_taiko_binding_verifications_taiko_id (taiko_id),
    KEY idx_web_taiko_binding_verifications_expires_at (expires_at),
    CONSTRAINT fk_web_taiko_binding_verifications_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_song_locks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL,
    song_no INT NOT NULL,
    level INT NOT NULL,
    is_locked TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_song_locks_owner_song (user_id, taiko_id, song_no, level),
    KEY idx_web_song_locks_taiko_song (taiko_id, song_no, level),
    CONSTRAINT fk_web_song_locks_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_data_sync_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    taiko_id VARCHAR(25) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'success',
    target_ids_json LONGTEXT NOT NULL,
    result_json LONGTEXT NOT NULL,
    original_bytes INT UNSIGNED NOT NULL DEFAULT 0,
    compressed_bytes INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_data_sync_logs_user_id_created_at (user_id, created_at),
    CONSTRAINT fk_web_data_sync_logs_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_developer_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    reply_email VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    image_urls_json LONGTEXT DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    review_note TEXT DEFAULT NULL,
    reviewed_by_user_id BIGINT UNSIGNED DEFAULT NULL,
    reviewed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_developer_applications_user_id_created_at (user_id, created_at),
    KEY idx_web_developer_applications_status_created_at (status, created_at),
    CONSTRAINT fk_web_developer_applications_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_developer_applications_reviewed_by_user_id FOREIGN KEY (reviewed_by_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_developer_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED DEFAULT NULL,
    token_hash CHAR(64) NOT NULL,
    token_mask VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    issued_by_user_id BIGINT UNSIGNED DEFAULT NULL,
    issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME DEFAULT NULL,
    revoked_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_developer_tokens_token_hash (token_hash),
    KEY idx_web_developer_tokens_user_id_status (user_id, status, issued_at),
    KEY idx_web_developer_tokens_application_id (application_id),
    CONSTRAINT fk_web_developer_tokens_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_developer_tokens_application_id FOREIGN KEY (application_id)
      REFERENCES web_developer_applications(id) ON DELETE SET NULL,
    CONSTRAINT fk_web_developer_tokens_issued_by_user_id FOREIGN KEY (issued_by_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_taiko_open_api_daily_usage (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(64) NOT NULL,
    api_name VARCHAR(128) NOT NULL,
    day_key DATE NOT NULL,
    request_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_open_api_daily_usage_ip_api_day (ip_address, api_name, day_key),
    KEY idx_web_taiko_open_api_daily_usage_day_key (day_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_support_tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    contact VARCHAR(255) DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'open',
    mail_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    mail_error VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_support_tickets_user_id_created_at (user_id, created_at),
    KEY idx_web_support_tickets_status_created_at (status, created_at),
    KEY idx_web_support_tickets_mail_status_created_at (mail_status, created_at),
    CONSTRAINT fk_web_support_tickets_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_support_ticket_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    ticket_id BIGINT UNSIGNED NOT NULL,
    author_role VARCHAR(16) NOT NULL,
    author_user_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    mail_status VARCHAR(16) NOT NULL DEFAULT 'skipped',
    mail_error VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_web_support_ticket_messages_ticket_id_created_at (ticket_id, created_at),
    CONSTRAINT fk_web_support_ticket_messages_ticket_id FOREIGN KEY (ticket_id)
      REFERENCES web_support_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_support_ticket_messages_author_user_id FOREIGN KEY (author_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

const MIGRATIONS = [
  "ALTER TABLE web_data_sync_logs ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  "ALTER TABLE web_developer_tokens ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  "ALTER TABLE web_support_tickets ADD COLUMN staff_last_read_at DATETIME NULL DEFAULT NULL AFTER mail_error",
  "ALTER TABLE web_support_tickets ADD COLUMN user_last_read_at DATETIME NULL DEFAULT NULL AFTER staff_last_read_at"
];

const runMigration = async (statement: string) => {
  const db = getAccountDb();
  try {
    await db.execute(statement);
  } catch (error: any) {
    const code = String(error?.code || "");
    const errno = Number(error?.errno || 0);
    if (
      code === "ER_DUP_FIELDNAME" ||
      code === "ER_DUP_KEYNAME" ||
      code === "ER_TABLE_EXISTS_ERROR" ||
      errno === 1060 ||
      errno === 1061 ||
      errno === 1050
    ) {
      return;
    }
    throw error;
  }
};

export const ensureAccountSchema = async () => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getAccountDb();
      for (const statement of CREATE_TABLES) {
        await db.execute(statement);
      }
      for (const statement of MIGRATIONS) {
        await runMigration(statement);
      }
    })();
  }
  await schemaReady;
};

export type DbRow<T> = T & RowDataPacket;
