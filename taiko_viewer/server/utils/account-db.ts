import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

const getDbConfig = () => {
  const runtimeConfig = useRuntimeConfig();
  const config = {
    host: String(runtimeConfig.dbHost || process.env.TAIKO_DB_HOST || "127.0.0.1"),
    port: Number(runtimeConfig.dbPort || process.env.TAIKO_DB_PORT || 3306),
    user: String(runtimeConfig.dbUser || process.env.TAIKO_DB_USER || ""),
    password: String(runtimeConfig.dbPassword || process.env.TAIKO_DB_PASSWORD || ""),
    database: String(runtimeConfig.dbName || process.env.TAIKO_DB_NAME || "taiko")
  };
  if (process.env.NODE_ENV === "production") {
    if (!config.user || !config.password) {
      throw new Error("Account database credentials are not configured");
    }
    if (config.user.toLowerCase() === "root") {
      throw new Error("Account database must use a dedicated non-root user");
    }
  }
  return config;
};

export const assertAccountDbConfiguration = () => {
  getDbConfig();
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

export const closeAccountDb = async () => {
  const currentPool = pool;
  pool = null;
  schemaReady = null;
  if (currentPool) await currentPool.end();
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
    mydon_showcase_layout VARCHAR(32) NOT NULL DEFAULT 'nickname',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_bindings_user_id_taiko_id (user_id, taiko_id),
    UNIQUE KEY uniq_web_taiko_bindings_taiko_id (taiko_id),
    KEY idx_web_taiko_bindings_user_id_current (user_id, is_current),
    CONSTRAINT fk_web_taiko_bindings_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_annual_summary_access (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    note VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_web_annual_summary_access_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS taiko_manual_accounts (
    taiko_id CHAR(18) NOT NULL PRIMARY KEY,
    nickname VARCHAR(64) NOT NULL,
    bot_identity_key VARCHAR(191) DEFAULT NULL,
    created_by VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_taiko_manual_accounts_bot_identity (bot_identity_key),
    CONSTRAINT chk_taiko_manual_accounts_id CHECK (taiko_id REGEXP '^98[0-9]{16}$')
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS taiko_manual_claim_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    taiko_id CHAR(18) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    issued_by VARCHAR(16) NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_taiko_manual_claim_codes_hash (code_hash),
    KEY idx_taiko_manual_claim_codes_account (taiko_id, expires_at),
    CONSTRAINT fk_taiko_manual_claim_codes_account FOREIGN KEY (taiko_id)
      REFERENCES taiko_manual_accounts(taiko_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS taiko_bind_identity_state (
    identity_key VARCHAR(191) NOT NULL PRIMARY KEY,
    current_virtual TINYINT(1) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  `CREATE TABLE IF NOT EXISTS web_taiko_binding_mydon_showcase_titles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    binding_id BIGINT UNSIGNED NOT NULL,
    slot_index INT NOT NULL,
    title_name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_taiko_binding_mydon_showcase_titles_binding_slot (binding_id, slot_index),
    UNIQUE KEY uniq_web_taiko_binding_mydon_showcase_titles_binding_title (binding_id, title_name),
    KEY idx_web_taiko_binding_mydon_showcase_titles_binding_id (binding_id),
    CONSTRAINT fk_web_taiko_binding_mydon_showcase_titles_binding_id FOREIGN KEY (binding_id)
      REFERENCES web_taiko_bindings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS taiko_custom_titles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title_name VARCHAR(255) NOT NULL,
    title_key VARCHAR(255) NOT NULL,
    song_id INT NOT NULL,
    difficulty_level TINYINT UNSIGNED NOT NULL,
    achievement_type VARCHAR(32) NOT NULL DEFAULT 'full_combo',
    creator_type VARCHAR(32) NOT NULL,
    creator_id VARCHAR(255) NOT NULL,
    creator_name VARCHAR(255) NOT NULL,
    source VARCHAR(32) NOT NULL,
    group_id VARCHAR(255) DEFAULT NULL,
    group_name VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_taiko_custom_titles_title_key (title_key),
    KEY idx_taiko_custom_titles_song_level (song_id, difficulty_level),
    KEY idx_taiko_custom_titles_creator (creator_id, created_at),
    CONSTRAINT chk_taiko_custom_titles_level CHECK (difficulty_level BETWEEN 1 AND 5)
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_admin_action_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(255) DEFAULT NULL,
    actor_name VARCHAR(255) DEFAULT NULL,
    source VARCHAR(32) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_key VARCHAR(255) NOT NULL,
    action VARCHAR(16) NOT NULL,
    before_json LONGTEXT DEFAULT NULL,
    after_json LONGTEXT DEFAULT NULL,
    extra_json LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_web_admin_action_logs_created_at (created_at),
    KEY idx_web_admin_action_logs_target (target_type, target_key, created_at),
    KEY idx_web_admin_action_logs_source_action (source, action, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_admin_access_rollups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    source_key VARCHAR(64) NOT NULL,
    granularity VARCHAR(16) NOT NULL,
    bucket_start DATETIME NOT NULL,
    metric_count INT UNSIGNED NOT NULL DEFAULT 0,
    pv_count INT UNSIGNED NOT NULL DEFAULT 0,
    uv_count INT UNSIGNED NOT NULL DEFAULT 0,
    home_pv_count INT UNSIGNED NOT NULL DEFAULT 0,
    extra_json LONGTEXT DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_admin_access_rollups_bucket (source_key, granularity, bucket_start),
    KEY idx_web_admin_access_rollups_bucket_start (granularity, bucket_start)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_admin_ingest_state (
    source_key VARCHAR(64) NOT NULL PRIMARY KEY,
    state_json LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_annual_summaries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    binding_id BIGINT UNSIGNED NOT NULL,
    version_key VARCHAR(64) NOT NULL,
    schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 4,
    data_mode VARCHAR(32) NOT NULL,
    input_fingerprint CHAR(64) NOT NULL,
    summary_path VARCHAR(1024) NOT NULL,
    events_path VARCHAR(1024) NOT NULL,
    event_count INT UNSIGNED NOT NULL DEFAULT 0,
    generated_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_annual_summaries_owner_version (user_id, binding_id, version_key, created_at),
    KEY idx_web_annual_summaries_fingerprint (input_fingerprint),
    CONSTRAINT fk_web_annual_summaries_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_summaries_binding_id FOREIGN KEY (binding_id)
      REFERENCES web_taiko_bindings(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_annual_summary_jobs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    binding_id BIGINT UNSIGNED NOT NULL,
    version_key VARCHAR(64) NOT NULL,
    job_type VARCHAR(16) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'queued',
    summary_id CHAR(36) DEFAULT NULL,
    poster_id CHAR(36) DEFAULT NULL,
    parameters_json LONGTEXT DEFAULT NULL,
    error_code VARCHAR(64) DEFAULT NULL,
    error_message VARCHAR(255) DEFAULT NULL,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_web_annual_summary_jobs_owner_created (user_id, created_at),
    KEY idx_web_annual_summary_jobs_status (status, job_type, created_at),
    KEY idx_web_annual_summary_jobs_summary (summary_id),
    CONSTRAINT fk_web_annual_summary_jobs_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_summary_jobs_binding_id FOREIGN KEY (binding_id)
      REFERENCES web_taiko_bindings(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_summary_jobs_summary_id FOREIGN KEY (summary_id)
      REFERENCES web_annual_summaries(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_annual_shares (
    id CHAR(36) NOT NULL PRIMARY KEY,
    summary_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'zh',
    token_hash CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_annual_shares_token_hash (token_hash),
    KEY idx_web_annual_shares_owner_status (user_id, status, created_at),
    KEY idx_web_annual_shares_summary_status (summary_id, status),
    KEY idx_web_annual_shares_expires_at (expires_at),
    CONSTRAINT fk_web_annual_shares_summary_id FOREIGN KEY (summary_id)
      REFERENCES web_annual_summaries(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_shares_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_annual_posters (
    id CHAR(36) NOT NULL PRIMARY KEY,
    summary_id CHAR(36) NOT NULL,
    share_id CHAR(36) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    locale VARCHAR(8) NOT NULL DEFAULT 'zh',
    fingerprint CHAR(64) NOT NULL,
    file_path VARCHAR(1024) NOT NULL,
    width INT UNSIGNED NOT NULL DEFAULT 1080,
    height INT UNSIGNED NOT NULL DEFAULT 1440,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_annual_posters_share_locale (share_id, locale),
    KEY idx_web_annual_posters_owner_created (user_id, created_at),
    KEY idx_web_annual_posters_summary (summary_id),
    CONSTRAINT fk_web_annual_posters_summary_id FOREIGN KEY (summary_id)
      REFERENCES web_annual_summaries(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_posters_share_id FOREIGN KEY (share_id)
      REFERENCES web_annual_shares(id) ON DELETE CASCADE,
    CONSTRAINT fk_web_annual_posters_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS web_user_qq_bindings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    qq_number VARCHAR(15) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    verify_code_hash CHAR(64) DEFAULT NULL,
    verify_code_expires_at DATETIME DEFAULT NULL,
    verify_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    verified_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_web_user_qq_bindings_user (user_id),
    UNIQUE KEY uniq_web_user_qq_bindings_qq (qq_number),
    KEY idx_web_user_qq_bindings_status (status),
    KEY idx_web_user_qq_bindings_qq (qq_number),
    CONSTRAINT fk_web_user_qq_bindings_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];

const MIGRATIONS = [
  "ALTER TABLE web_taiko_bindings ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'wahlap' AFTER taiko_id",
  "ALTER TABLE web_taiko_bindings ADD COLUMN manual_account_id CHAR(18) DEFAULT NULL AFTER source",
  "ALTER TABLE web_taiko_bindings ADD COLUMN mydon_showcase_layout VARCHAR(32) NOT NULL DEFAULT 'nickname' AFTER verified_titleplate_id",
  "ALTER TABLE taiko_custom_titles ADD COLUMN achievement_type VARCHAR(32) NOT NULL DEFAULT 'full_combo' AFTER difficulty_level",
  "ALTER TABLE web_data_sync_logs ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  "ALTER TABLE web_developer_tokens ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
  "ALTER TABLE web_support_tickets ADD COLUMN staff_last_read_at DATETIME NULL DEFAULT NULL AFTER mail_error",
  "ALTER TABLE web_support_tickets ADD COLUMN user_last_read_at DATETIME NULL DEFAULT NULL AFTER staff_last_read_at",
  "ALTER TABLE web_user_qq_bindings ADD COLUMN verify_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER verify_code_expires_at",
  "ALTER TABLE web_user_qq_bindings ADD UNIQUE KEY uniq_web_user_qq_bindings_user (user_id)",
  "ALTER TABLE web_user_qq_bindings ADD UNIQUE KEY uniq_web_user_qq_bindings_qq (qq_number)"
];

const BIND_TABLE_CREATE_SQL = `CREATE TABLE IF NOT EXISTS bind (
  qq VARCHAR(191) NOT NULL,
  id VARCHAR(25) NOT NULL,
  visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

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

type ColumnRow = {
  Field: string;
  Type: string;
  Null: "YES" | "NO";
  Key: string;
  Default: string | null;
  Extra: string;
} & RowDataPacket;

type IndexRow = {
  Key_name: string;
  Column_name: string;
  Non_unique: number;
  Seq_in_index: number;
} & RowDataPacket;

const ensureBindTableSchema = async () => {
  const db = getAccountDb();
  await db.execute(BIND_TABLE_CREATE_SQL);

  const [columnRows] = await db.query<ColumnRow[]>("SHOW COLUMNS FROM bind");
  const columnNames = new Set(columnRows.map((row) => String(row.Field || "").trim()));

  const primaryColumns = columnRows
    .filter((row) => row.Key === "PRI")
    .sort((a, b) => String(a.Field).localeCompare(String(b.Field)))
    .map((row) => String(row.Field || "").trim());
  const hasPrimaryKeyOnRowId = primaryColumns.length === 1 && primaryColumns[0] === "row_id";

  if (!hasPrimaryKeyOnRowId && primaryColumns.length > 0) {
    await db.execute("ALTER TABLE bind DROP PRIMARY KEY");
  }

  if (!columnNames.has("row_id")) {
    await db.execute(
      "ALTER TABLE bind ADD COLUMN row_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST"
    );
  } else if (!hasPrimaryKeyOnRowId) {
    await db.execute("ALTER TABLE bind ADD PRIMARY KEY (row_id)");
  }

  if (!columnNames.has("slot_index")) {
    await db.execute("ALTER TABLE bind ADD COLUMN slot_index INT NOT NULL DEFAULT 1 AFTER visible");
  }
  if (!columnNames.has("is_current")) {
    await db.execute("ALTER TABLE bind ADD COLUMN is_current TINYINT(1) NOT NULL DEFAULT 1 AFTER slot_index");
  }
  if (!columnNames.has("source")) {
    await db.execute(
      "ALTER TABLE bind ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'wahlap' AFTER is_current"
    );
  }
  if (!columnNames.has("created_at")) {
    // Keep legacy rows un-timestamped so a schema rollout does not count every
    // historical bot binding as a binding created today.
    await db.execute(
      "ALTER TABLE bind ADD COLUMN created_at DATETIME NULL DEFAULT NULL AFTER source"
    );
  }
  await db.execute(
    "ALTER TABLE bind MODIFY COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER source"
  );

  await db.execute(
    "UPDATE bind SET slot_index = 1 WHERE slot_index IS NULL OR slot_index <= 0"
  );
  await db.execute(
    "UPDATE bind SET is_current = 1 WHERE is_current IS NULL"
  );
  await db.execute(
    "UPDATE bind SET source = 'wahlap' WHERE source IS NULL OR TRIM(source) = ''"
  );

  const [indexRows] = await db.query<IndexRow[]>("SHOW INDEX FROM bind");
  const indexNames = new Set(indexRows.map((row) => String(row.Key_name || "").trim()));
  if (!indexNames.has("uniq_bind_identity_slot")) {
    await db.execute("ALTER TABLE bind ADD UNIQUE KEY uniq_bind_identity_slot (qq, slot_index)");
  }
  if (!indexNames.has("uniq_bind_identity_taiko")) {
    await db.execute("ALTER TABLE bind ADD UNIQUE KEY uniq_bind_identity_taiko (qq, id)");
  }
  if (!indexNames.has("idx_bind_identity_current")) {
    await db.execute("ALTER TABLE bind ADD KEY idx_bind_identity_current (qq, is_current)");
  }
  if (!indexNames.has("idx_bind_created_at")) {
    await db.execute("ALTER TABLE bind ADD KEY idx_bind_created_at (created_at)");
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
      await ensureBindTableSchema();
    })();
  }
  await schemaReady;
};

export type DbRow<T> = T & RowDataPacket;
