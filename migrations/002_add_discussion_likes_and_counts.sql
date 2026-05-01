-- Add likes_count and reply_count to discussions for performance
-- Create discussion_likes table for tracking post likes

-- Add columns to discussions
ALTER TABLE discussions ADD COLUMN likes_count INT DEFAULT 0;
ALTER TABLE discussions ADD COLUMN reply_count INT DEFAULT 0;

-- Create discussion_likes table
CREATE TABLE IF NOT EXISTS discussion_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    discussion_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_discussion_like (discussion_id, user_id),
    INDEX idx_discussion (discussion_id),
    INDEX idx_user (user_id)
);
