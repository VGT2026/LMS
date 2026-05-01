-- Migration: Add AI Summaries table for storing user-generated summaries
-- Stores summaries created by students for study materials

CREATE TABLE IF NOT EXISTS ai_summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT,
  lesson_id INT,
  
  -- Original content
  original_content TEXT NOT NULL,
  original_content_length INT NOT NULL,
  
  -- Generated summary data
  title VARCHAR(255) NOT NULL,
  short_summary LONGTEXT NOT NULL,
  key_points JSON,
  study_notes LONGTEXT,
  
  -- Metadata
  word_count INT,
  reading_time VARCHAR(50),
  content_type VARCHAR(20) DEFAULT 'text',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for common queries
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_lesson_id (lesson_id),
  INDEX idx_created_at (created_at),
  
  -- Foreign key constraint
  CONSTRAINT fk_ai_summaries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add helpful comment
ALTER TABLE ai_summaries COMMENT = 'Stores AI-generated summaries created by students from course content';
