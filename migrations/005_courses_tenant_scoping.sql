-- Course multi-tenant scoping (idempotent companion to src/scripts/runMigrations.ts)
-- tenants.id is INT; courses.tenant_id uses INT for FK compatibility (not BIGINT).

-- Column + index + FK (skip if already applied via runMigrations)
-- ALTER TABLE courses ADD COLUMN tenant_id INT NULL;
-- ALTER TABLE courses ADD INDEX idx_courses_tenant (tenant_id);
-- ALTER TABLE courses ADD CONSTRAINT fk_courses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT;

-- Backfill from instructor's organization when still NULL
UPDATE courses c
INNER JOIN users u ON c.instructor_id = u.id
SET c.tenant_id = u.tenant_id
WHERE c.tenant_id IS NULL
  AND u.tenant_id IS NOT NULL
  AND u.role IN ('admin', 'instructor');

-- Platform-wide catalog: leave tenant_id NULL only for intentionally global courses.
