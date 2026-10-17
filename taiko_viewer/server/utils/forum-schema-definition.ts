export const CREATE_FORUM_TABLES = [
  `CREATE TABLE IF NOT EXISTS forum_user_profiles (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    role VARCHAR(16) NOT NULL DEFAULT 'user',
    signature VARCHAR(255) DEFAULT NULL,
    reputation INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_forum_user_profiles_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_sections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    icon VARCHAR(32) NOT NULL,
    accent_color VARCHAR(16) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_sections_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_threads (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    section_id BIGINT UNSIGNED NOT NULL,
    author_user_id BIGINT UNSIGNED NOT NULL,
    thread_type VARCHAR(16) NOT NULL,
    title VARCHAR(120) NOT NULL,
    summary VARCHAR(280) NOT NULL,
    content_blocks_json LONGTEXT NOT NULL,
    cover_image_url VARCHAR(1024) DEFAULT NULL,
    tags_json LONGTEXT DEFAULT NULL,
    song_id INT DEFAULT NULL,
    difficulty_type INT DEFAULT NULL,
    level INT DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'published',
    is_pinned TINYINT(1) NOT NULL DEFAULT 0,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    view_count INT NOT NULL DEFAULT 0,
    like_count INT NOT NULL DEFAULT 0,
    reply_count INT NOT NULL DEFAULT 0,
    latest_post_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_forum_threads_section_sort (section_id, status, is_pinned, is_featured, latest_post_at),
    KEY idx_forum_threads_type_sort (thread_type, status, latest_post_at),
    KEY idx_forum_threads_song (song_id, difficulty_type, level),
    KEY idx_forum_threads_author (author_user_id, created_at),
    CONSTRAINT fk_forum_threads_section_id FOREIGN KEY (section_id)
      REFERENCES forum_sections(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_threads_author_user_id FOREIGN KEY (author_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_posts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    author_user_id BIGINT UNSIGNED NOT NULL,
    parent_post_id BIGINT UNSIGNED DEFAULT NULL,
    root_post_id BIGINT UNSIGNED DEFAULT NULL,
    floor_no INT NOT NULL DEFAULT 0,
    body_text TEXT NOT NULL,
    content_blocks_json LONGTEXT DEFAULT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'published',
    like_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_forum_posts_thread_floor (thread_id, status, floor_no, created_at),
    KEY idx_forum_posts_parent (parent_post_id, created_at),
    CONSTRAINT fk_forum_posts_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_posts_author_user_id FOREIGN KEY (author_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_posts_parent_post_id FOREIGN KEY (parent_post_id)
      REFERENCES forum_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_posts_root_post_id FOREIGN KEY (root_post_id)
      REFERENCES forum_posts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_thread_likes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_thread_like (thread_id, user_id),
    KEY idx_forum_thread_likes_user_id (user_id, created_at),
    CONSTRAINT fk_forum_thread_likes_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_thread_likes_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_post_likes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_post_like (post_id, user_id),
    KEY idx_forum_post_likes_user_id (user_id, created_at),
    CONSTRAINT fk_forum_post_likes_post_id FOREIGN KEY (post_id)
      REFERENCES forum_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_post_likes_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    actor_user_id BIGINT UNSIGNED DEFAULT NULL,
    type VARCHAR(16) NOT NULL,
    title VARCHAR(120) NOT NULL,
    body VARCHAR(255) NOT NULL,
    message_key VARCHAR(64) DEFAULT NULL,
    message_params_json LONGTEXT DEFAULT NULL,
    thread_id BIGINT UNSIGNED DEFAULT NULL,
    post_id BIGINT UNSIGNED DEFAULT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_forum_notifications_user_read (user_id, is_read, created_at),
    CONSTRAINT fk_forum_notifications_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_notifications_actor_user_id FOREIGN KEY (actor_user_id)
      REFERENCES web_user_accounts(id) ON DELETE SET NULL,
    CONSTRAINT fk_forum_notifications_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_notifications_post_id FOREIGN KEY (post_id)
      REFERENCES forum_posts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_moderation_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    operator_user_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(32) NOT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_forum_moderation_logs_thread_id (thread_id, created_at),
    CONSTRAINT fk_forum_moderation_logs_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_moderation_logs_operator_user_id FOREIGN KEY (operator_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_thread_favorites (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_thread_favorite (thread_id, user_id),
    KEY idx_forum_thread_favorites_user_id (user_id, created_at),
    CONSTRAINT fk_forum_thread_favorites_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_thread_favorites_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_thread_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    thread_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_thread_history (thread_id, user_id),
    KEY idx_forum_thread_history_user_id (user_id, viewed_at),
    CONSTRAINT fk_forum_thread_history_thread_id FOREIGN KEY (thread_id)
      REFERENCES forum_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_thread_history_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_user_follows (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    follower_user_id BIGINT UNSIGNED NOT NULL,
    followed_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_user_follow (follower_user_id, followed_user_id),
    KEY idx_forum_user_follows_followed (followed_user_id, created_at),
    CONSTRAINT fk_forum_user_follows_follower_user_id FOREIGN KEY (follower_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_user_follows_followed_user_id FOREIGN KEY (followed_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_user_blocks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    blocked_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_forum_user_block (user_id, blocked_user_id),
    KEY idx_forum_user_blocks_blocked (blocked_user_id, created_at),
    CONSTRAINT fk_forum_user_blocks_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_forum_user_blocks_blocked_user_id FOREIGN KEY (blocked_user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS forum_feedback (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    contact VARCHAR(255) DEFAULT NULL,
    app_version VARCHAR(64) DEFAULT NULL,
    platform VARCHAR(64) DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_forum_feedback_user_id (user_id, created_at),
    CONSTRAINT fk_forum_feedback_user_id FOREIGN KEY (user_id)
      REFERENCES web_user_accounts(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export const MIGRATIONS = [
  "ALTER TABLE forum_user_profiles ADD COLUMN record_history_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER reputation",
  "ALTER TABLE forum_posts ADD COLUMN content_blocks_json LONGTEXT DEFAULT NULL AFTER body_text",
  "ALTER TABLE forum_posts ADD KEY idx_forum_posts_root_post_id (root_post_id, created_at)",
  "ALTER TABLE forum_notifications ADD COLUMN message_key VARCHAR(64) DEFAULT NULL AFTER body",
  "ALTER TABLE forum_notifications ADD COLUMN message_params_json LONGTEXT DEFAULT NULL AFTER message_key"
];

