import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const checkAdminUser = async () => {
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lms_database',
    });

    console.log('🔍 Checking admin user details...');

    const [rows] = await connection.query(
      'SELECT id, name, email, password, role, is_active FROM users WHERE role = ?',
      ['admin']
    );

    const adminUser = (rows as any[])[0];
    if (adminUser) {
      console.log('👤 Admin user found:');
      console.log(`   Name: ${adminUser.name}`);
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Active: ${adminUser.is_active}`);
      console.log(`   Password hash: ${adminUser.password.substring(0, 30)}...`);
      console.log(`   Hash length: ${adminUser.password.length}`);
    } else {
      console.log('❌ No admin user found!');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

checkAdminUser();