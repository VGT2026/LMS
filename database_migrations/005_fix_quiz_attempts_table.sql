-- Migration 005: Rebuild quiz_attempts table to match the QuizAttemptModel
-- The old schema was missing: tab_lock_id, answers_json, logs_json,
-- correct_count, wrong_count, submitted_at

-- Drop and recreate with the correct columns
DROP TABLE IF EXISTS quiz_attempts;

CREATE TABLE quiz_attempts (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    quiz_id      INT NOT NULL,
    user_id      INT NOT NULL,
    tab_lock_id  VARCHAR(128) NULL,
    answers_json LONGTEXT NULL,
    logs_json    LONGTEXT NULL,
    score        DECIMAL(8,2) NULL,
    correct_count INT NULL,
    wrong_count   INT NULL,
    started_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_qa_quiz (quiz_id),
    INDEX idx_qa_user (user_id),
    INDEX idx_qa_quiz_user (quiz_id, user_id)
);
