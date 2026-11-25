-- Add the dispatched state to existing V2 databases.
-- Run once on each existing database after taking a full backup.
ALTER TABLE pos_orders
  MODIFY status ENUM('new','preparing','ready','dispatched','delivered','cancelled')
  NOT NULL DEFAULT 'new';
