import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const cleanupTestUser = async () => {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lms_database',
    });

    const [result] = await connection.query('DELETE FROM users WHERE email = ?', ['test@example.com']);
    console.log(`✅ Test user deleted (${(result as any).affectedRows} rows affected)`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

cleanupTestUser();