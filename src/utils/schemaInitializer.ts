import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

const parseSqlCommands = (sql: string): string[] => {
  return sql
    .split(';')
    .map(cmd => cmd.trim())
    .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
};

export const ensureDatabaseSchema = async (): Promise<void> => {
  const schemaPath = path.join(process.cwd(), 'database_schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Database schema file not found at ${schemaPath}`);
  }

  const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
  const commands = parseSqlCommands(schemaSQL);

  for (const command of commands) {
    await pool.execute(command);
  }

  console.log('✅ Database schema ensured');
};
