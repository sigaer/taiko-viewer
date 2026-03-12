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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

export const ensureAccountSchema = async () => {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getAccountDb();
      for (const statement of CREATE_TABLES) {
        await db.execute(statement);
      }
    })();
  }
  await schemaReady;
};

export type DbRow<T> = T & RowDataPacket;
