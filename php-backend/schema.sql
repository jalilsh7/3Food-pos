CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('manager','cashier','kitchen') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  session_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_users_username (username),
  KEY idx_app_users_active_role (is_active, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username_key CHAR(64) NOT NULL,
  ip_key CHAR(64) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  was_successful TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_login_username_time (username_key, attempted_at),
  KEY idx_login_ip_time (ip_key, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  ip_address VARCHAR(45) NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor_time (actor_user_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_install_state (
  id TINYINT UNSIGNED NOT NULL,
  setup_completed TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_install_state_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_install_state (id, setup_completed) VALUES (1, 0);


-- Central POS data store. Payloads preserve the existing TypeScript model while
-- keeping all writes on the server and shared across devices.
CREATE TABLE IF NOT EXISTS pos_records (
  id VARCHAR(100) NOT NULL,
  resource VARCHAR(40) NOT NULL,
  payload JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (resource, id),
  KEY idx_pos_records_resource_updated (resource, updated_at),
  CONSTRAINT fk_pos_records_actor FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pos_counters (
  counter_key VARCHAR(40) NOT NULL,
  counter_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (counter_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO pos_counters (counter_key, counter_value) VALUES ('order_number', 1041);

CREATE TABLE IF NOT EXISTS pos_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number BIGINT UNSIGNED NOT NULL,
  status ENUM('new','preparing','ready','delivered','cancelled') NOT NULL DEFAULT 'new',
  idempotency_key CHAR(36) NULL,
  request_hash CHAR(64) NULL,
  customer_id VARCHAR(100) NULL,
  customer_name VARCHAR(160) NULL,
  customer_phone VARCHAR(30) NULL,
  discount_code VARCHAR(64) NULL,
  items JSON NOT NULL,
  totals JSON NOT NULL,
  note TEXT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pos_order_number (order_number),
  UNIQUE KEY uq_pos_order_idempotency (idempotency_key),
  KEY idx_pos_orders_status_created (status, created_at),
  KEY idx_pos_orders_customer (customer_id),
  KEY idx_pos_orders_discount_customer (discount_code, customer_id, status),
  CONSTRAINT fk_pos_orders_creator FOREIGN KEY (created_by) REFERENCES app_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exact, one-time reversible effects produced by each checkout.
CREATE TABLE IF NOT EXISTS pos_order_effects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  effect_type ENUM('ingredient','customer') NOT NULL,
  resource_id VARCHAR(100) NOT NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  points_spent BIGINT NOT NULL DEFAULT 0,
  points_earned BIGINT NOT NULL DEFAULT 0,
  money_delta BIGINT NOT NULL DEFAULT 0,
  visits_delta INT NOT NULL DEFAULT 0,
  reversed_at DATETIME NULL,
  reversed_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pos_order_effect (order_id, effect_type, resource_id),
  KEY idx_pos_order_effect_reversal (order_id, reversed_at),
  CONSTRAINT fk_pos_order_effect_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pos_order_effect_actor FOREIGN KEY (reversed_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Immutable redemption ledger; quota checks use this table rather than mutable UI counters.
CREATE TABLE IF NOT EXISTS pos_discount_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  discount_id VARCHAR(100) NOT NULL,
  code VARCHAR(64) NOT NULL,
  customer_id VARCHAR(100) NULL,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pos_discount_redemption_order (order_id),
  KEY idx_pos_discount_redemption_global (discount_id, redeemed_at),
  KEY idx_pos_discount_redemption_customer (discount_id, customer_id),
  CONSTRAINT fk_pos_discount_redemption_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
