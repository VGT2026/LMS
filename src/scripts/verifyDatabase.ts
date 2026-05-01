import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const verifyDatabase = async () => {
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

    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n📋 Database Tables:');
    console.log('==================');

    if (Array.isArray(tables)) {
      tables.forEach((table: any, index: number) => {
        const tableName = Object.values(table)[0] as string;
        console.log(`${index + 1}. ${tableName}`);
      });
    }

    // Count records in key tables
    console.log('\n📊 Table Record Counts:');
    console.log('=======================');

    const tablesToCheck = [
      'users',
      'courses',
      'course_modules',
      'lessons',
      'enrollments',
      'job_roles',
      'announcements',
      'discussions'
    ];

    for (const table of tablesToCheck) {
      try {
        const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = (countResult as any[])[0].count;
        console.log(`${table}: ${count} records`);
      } catch (error) {
        console.log(`${table}: Error checking count`);
      }
    }

    // Check admin user
    console.log('\n👤 Admin User Check:');
    console.log('===================');
    const [adminUsers] = await connection.query(
      'SELECT id, name, email, role, is_active FROM users WHERE role = "admin"'
    );

    if (Array.isArray(adminUsers) && adminUsers.length > 0) {
      console.log('✅ Admin user found:');
      adminUsers.forEach((user: any) => {
        console.log(`   - ${user.name} (${user.email})`);
      });
    } else {
      console.log('❌ No admin user found');
    }

    console.log('\n🎯 Database verification complete!');

  } catch (error) {
    console.error('❌ Database verification failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run verification
verifyDatabase();