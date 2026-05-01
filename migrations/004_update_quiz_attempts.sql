-- Update quiz_attempts table to support full exam session tracking
ALTER TABLE quiz_attempts
  MODIFY COLUMN score DECIMAL(5,2) NULL,
  ADD COLUMN IF NOT EXISTS tab_lock_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS answers_json LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS logs_json LONGTEXT NULL,
  ADD COLUMN IF NOT EXISTS correct_count INT NULL,
  ADD COLUMN IF NOT EXISTS wrong_count INT NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP NULL;
