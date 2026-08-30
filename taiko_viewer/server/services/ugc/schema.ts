export const UGC_TABLE_NAMES = [
  "ugc_charts",
  "ugc_tags",
  "chart_difficulty_votes",
  "chart_tag_votes",
  "chart_tips",
  "chart_tip_helpful",
  "chart_tip_reports",
  "chart_ugc_moderation_logs"
] as const;

export const UGC_CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS ugc_charts (
    chart_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    song_id INT NOT NULL,
    difficulty_code TINYINT UNSIGNED NOT NULL,
    source_key VARCHAR(64) NOT NULL,
    catalog_revision VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ugc_charts_source (source_key),
    UNIQUE KEY uniq_ugc_charts_catalog_pair (catalog_revision, song_id, difficulty_code),
    KEY idx_ugc_charts_song (song_id, difficulty_code),
    KEY idx_ugc_charts_status (status, song_id, difficulty_code),
    CONSTRAINT chk_ugc_charts_difficulty CHECK (difficulty_code BETWEEN 1 AND 5),
    CONSTRAINT chk_ugc_charts_status CHECK (status IN ('active', 'inactive'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS ugc_tags (
    tag_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    label_key VARCHAR(128) NOT NULL,
    group_key VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ugc_tags_slug (slug),
    KEY idx_ugc_tags_status_group (status, group_key, sort_order),
    CONSTRAINT chk_ugc_tags_status CHECK (status IN ('active', 'deprecated'))
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_difficulty_votes (
    chart_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    value TINYINT NOT NULL,
    verified_play TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chart_id, user_id),
    CONSTRAINT chk_chart_difficulty_vote_value CHECK (value BETWEEN -2 AND 2),
    CONSTRAINT fk_chart_difficulty_votes_chart FOREIGN KEY (chart_id)
      REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_difficulty_votes_user FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_tag_votes (
    chart_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    verified_play TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (chart_id, tag_id, user_id),
    KEY idx_chart_tag_votes_chart_user (chart_id, user_id),
    CONSTRAINT fk_chart_tag_votes_chart FOREIGN KEY (chart_id)
      REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_tag_votes_tag FOREIGN KEY (tag_id)
      REFERENCES ugc_tags(tag_id) ON DELETE RESTRICT,
    CONSTRAINT fk_chart_tag_votes_user FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_tips (
    tip_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chart_id BIGINT UNSIGNED NOT NULL,
    author_user_id BIGINT UNSIGNED DEFAULT NULL,
    body_text VARCHAR(120) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    verified_play TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL,
    UNIQUE KEY uniq_chart_tip_author (chart_id, author_user_id),
    KEY idx_chart_tips_public (chart_id, status, created_at, tip_id),
    CONSTRAINT chk_chart_tips_status CHECK (status IN ('active', 'hidden', 'deleted')),
    CONSTRAINT fk_chart_tips_chart FOREIGN KEY (chart_id)
      REFERENCES ugc_charts(chart_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_tips_author FOREIGN KEY (author_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_tip_helpful (
    tip_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tip_id, user_id),
    KEY idx_chart_tip_helpful_user (user_id, created_at),
    CONSTRAINT fk_chart_tip_helpful_tip FOREIGN KEY (tip_id)
      REFERENCES chart_tips(tip_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_tip_helpful_user FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_tip_reports (
    report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tip_id BIGINT UNSIGNED NOT NULL,
    reporter_user_id BIGINT UNSIGNED DEFAULT NULL,
    reason VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    note VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    resolved_by_user_id BIGINT UNSIGNED DEFAULT NULL,
    UNIQUE KEY uniq_chart_tip_reporter (tip_id, reporter_user_id),
    KEY idx_chart_tip_reports_queue (status, created_at),
    CONSTRAINT chk_chart_tip_reports_status CHECK (status IN ('pending', 'resolved', 'dismissed')),
    CONSTRAINT fk_chart_tip_reports_tip FOREIGN KEY (tip_id)
      REFERENCES chart_tips(tip_id) ON DELETE CASCADE,
    CONSTRAINT fk_chart_tip_reports_reporter FOREIGN KEY (reporter_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_chart_tip_reports_resolver FOREIGN KEY (resolved_by_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS chart_ugc_moderation_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    target_type VARCHAR(16) NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    operator_user_id BIGINT UNSIGNED DEFAULT NULL,
    action VARCHAR(32) NOT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_chart_ugc_moderation_target (target_type, target_id, created_at),
    KEY idx_chart_ugc_moderation_operator (operator_user_id, created_at),
    CONSTRAINT fk_chart_ugc_moderation_operator FOREIGN KEY (operator_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
] as const;

export const UGC_DROP_TABLE_STATEMENTS = [
  "DROP TABLE IF EXISTS chart_ugc_moderation_logs",
  "DROP TABLE IF EXISTS chart_tip_reports",
  "DROP TABLE IF EXISTS chart_tip_helpful",
  "DROP TABLE IF EXISTS chart_tips",
  "DROP TABLE IF EXISTS chart_tag_votes",
  "DROP TABLE IF EXISTS chart_difficulty_votes",
  "DROP TABLE IF EXISTS ugc_tags",
  "DROP TABLE IF EXISTS ugc_charts"
] as const;
