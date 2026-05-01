-- Add pdf_url to course_modules for module-level PDF resources
-- Run once. If column already exists, ignore the error.
ALTER TABLE course_modules ADD COLUMN pdf_url VARCHAR(500) NULL;
