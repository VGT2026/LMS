import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const deleteAdmin = async () => {
  let connection: mysql.Connection | null = null;

  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lms_database',
    });

    console.log('📡 Connected to LMS Database');

    // Force delete admin user
    await connection.query('DELETE FROM users WHERE email = ?', ['admin@lmspro.com']);

    console.log('🗑️ Admin user deleted from database');

  } catch (error) {
    console.error('❌ Admin deletion failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run deletion
deleteAdmin();