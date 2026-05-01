import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const checkAdminPassword = async () => {
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

    // Get admin user details
    const [adminUsers] = await connection.query(
      'SELECT id, name, email, password, role, is_active FROM users WHERE email = ?',
      ['admin@lmspro.com']
    );

    if (Array.isArray(adminUsers) && adminUsers.length > 0) {
      const admin = adminUsers[0] as any;
      console.log('\n👤 Admin User Details:');
      console.log('======================');
      console.log(`ID: ${admin.id}`);
      console.log(`Name: ${admin.name}`);
      console.log(`Email: ${admin.email}`);
      console.log(`Role: ${admin.role}`);
      console.log(`Active: ${admin.is_active}`);
      console.log(`Password Hash: ${admin.password.substring(0, 20)}...`);
      console.log(`Hash Length: ${admin.password.length}`);
    } else {
      console.log('❌ Admin user not found');
    }

  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run check
checkAdminPassword();