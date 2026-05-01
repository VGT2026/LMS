-- Add completed_lessons JSON column to enrollments for tracking which modules are completed
-- Stores array of module IDs as strings, e.g. ["1", "2", "3"]

-- Run this if the column doesn't exist yet
ALTER TABLE enrollments ADD COLUMN completed_lessons JSON DEFAULT NULL;
