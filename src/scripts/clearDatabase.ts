import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const clearDatabase = async () => {
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

    // Disable foreign key checks temporarily
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🔓 Foreign key checks disabled');

    // Clear all tables in the correct order (reverse dependency order)
    const tablesToClear = [
      'user_progress',
      'roadmap',
      'announcements',
      'certificates',
      'discussion_likes',
      'discussion_replies',
      'discussions',
      'quiz_attempts',
      'quiz_questions',
      'quizzes',
      'submissions',
      'assignments',
      'enrollments',
      'lessons',
      'course_modules',
      'courses',
      'job_roles',
      'users'
    ];

    console.log('\n🗑️ Clearing database tables...');

    for (const table of tablesToClear) {
      try {
        const [result] = await connection.query(`DELETE FROM ${table}`);
        const deletedRows = (result as any).affectedRows;
        console.log(`   ✅ ${table}: ${deletedRows} records deleted`);
      } catch (error) {
        console.log(`   ❌ ${table}: Failed to clear - ${(error as Error).message}`);
      }
    }

    // Reset auto-increment counters
    console.log('\n🔄 Resetting auto-increment counters...');
    for (const table of tablesToClear) {
      try {
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        console.log(`   ✅ ${table}: Auto-increment reset`);
      } catch (error) {
        // Some tables might not have auto-increment, ignore errors
      }
    }

    // Re-enable foreign key checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🔒 Foreign key checks re-enabled');

    console.log('\n🎯 Database cleared successfully!');
    console.log('📊 All tables are now empty and ready for fresh data.');

    // Optional: Re-insert admin user
    console.log('\n👤 Re-inserting admin user...');
    const hashedPassword = '$2b$12$cu0uSeZGVre8KHkB/0Hw9e9K2C9ppxvINTjDi2ox5b5lQO8SImal6';

    await connection.query(`
      INSERT INTO users (
        name, email, password, role, is_active,
        preferred_categories, completed_course_ids, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, ['System Administrator', 'admin@lmspro.com', hashedPassword, 'admin', true, '[]', '[]']);

    console.log('✅ Admin user re-inserted');
    console.log('🔑 Admin login: admin@lmspro.com / admin123');

  } catch (error) {
    console.error('❌ Database clear failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run clear operation
clearDatabase();