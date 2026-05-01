import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

const parseSqlCommands = (sql: string): string[] => {
  // Remove single-line comments
  let cleaned = sql
    .split('\n')
    .map(line => {
      const commentIdx = line.indexOf('--');
      return commentIdx >= 0 ? line.substring(0, commentIdx) : line;
    })
    .join('\n');

  // Split on semicolons and filter
  return cleaned
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && cmd.toUpperCase() !== 'COMMIT');
};

const isNonCriticalError = (error: any, sql: string): boolean => {
  const upperSql = sql.toUpperCase();

  // Index/constraint errors are non-critical (likely already exists)
  if (upperSql.includes('CREATE INDEX') || upperSql.includes('ALTER TABLE')) {
    if (
      error.code === 'ER_NO_SUCH_TABLE' ||
      error.code === 'ER_DUP_KEYNAME' ||
      error.code === 'ER_DUP_FIELDNAME'
    ) {
      return true;
    }
  }

  return false;
};

export const ensureDatabaseSchema = async (): Promise<void> => {
  const schemaPath = path.join(process.cwd(), 'database_schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Database schema file not found at ${schemaPath}`);
  }

  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
  const commands = parseSqlCommands(schemaSQL);

  let successCount = 0;
  let skipCount = 0;

  for (const command of commands) {
    try {
      await pool.execute(command);
      successCount++;
    } catch (error: any) {
      if (isNonCriticalError(error, command)) {
        skipCount++;
        console.log(`⏭️ Skipped non-critical error: ${error.sqlMessage || error.message}`);
      } else {
        console.error(`❌ Critical SQL error: ${error.sqlMessage || error.message}`);
        console.error(`SQL: ${command}`);
        throw error;
      }
    }
  }

  console.log(`✅ Database schema ensured (${successCount} executed, ${skipCount} skipped)`);
};
