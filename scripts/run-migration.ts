import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_database',
  });
  try {
    await conn.query('ALTER TABLE enrollments ADD COLUMN completed_lessons JSON DEFAULT NULL');
    console.log('Migration: added completed_lessons column');
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Column completed_lessons already exists');
    } else {
      throw e;
    }
  } finally {
    await conn.end();
  }
}

run();
