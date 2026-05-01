import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const checkUsers = async () => {
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

    // Get all users
    const [users] = await connection.query('SELECT id, name, email, role, is_active FROM users');

    console.log('\n👥 Users in Database:');
    console.log('=====================');

    if (Array.isArray(users) && users.length > 0) {
      users.forEach((user: any, index: number) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role} - ${user.is_active ? 'Active' : 'Inactive'}`);
      });
    } else {
      console.log('No users found');
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
checkUsers();