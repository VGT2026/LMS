import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const getDatabaseConfig = () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '3306', 10),
      user: decodeURIComponent(url.username) || 'root',
      password: decodeURIComponent(url.password) || '',
      database: url.pathname?.slice(1) || process.env.DB_NAME || 'lms_database',
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_database',
  };
};

const runMigrations = async () => {
  let connection: mysql.Connection | null = null;
  const dbConfig = getDatabaseConfig();
  try {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    });
    console.log('📡 Connected to database');

    // Migration: Add pdf_url to course_modules
    try {
      await connection.query('ALTER TABLE course_modules ADD COLUMN pdf_url VARCHAR(500) NULL');
      console.log('✅ Added pdf_url to course_modules');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ pdf_url already exists in course_modules');
      } else throw err;
    }

    // Migration: Add pdf_url to lessons
    try {
      await connection.query('ALTER TABLE lessons ADD COLUMN pdf_url VARCHAR(500) NULL');
      console.log('✅ Added pdf_url to lessons');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ pdf_url already exists in lessons');
      } else throw err;
    }

    // Migration: Add approval_status to courses (pending | approved | rejected)
    try {
      await connection.query("ALTER TABLE courses ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'");
      console.log('✅ Added approval_status to courses');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ approval_status already exists in courses');
      } else throw err;
    }

    // Backfill: approve all existing courses (created before this migration)
    try {
      await connection.query("UPDATE courses SET approval_status = 'approved'");
      console.log('✅ Backfilled approval_status for existing courses');
    } catch (_) {
      // ignore
    }

    // Migration: Add firebase_uid for Firebase Auth
    try {
      await connection.query('ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) NULL UNIQUE');
      console.log('✅ Added firebase_uid to users');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ firebase_uid already exists in users');
      } else throw err;
    }

    // Migration: Make password nullable (Firebase users don't store password in our DB)
    try {
      await connection.query('ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL');
      console.log('✅ Made password nullable for Firebase users');
    } catch (err: any) {
      console.log('⏭️ Password column update skipped:', (err as Error).message);
    }

    // Migration: Add questions JSON to assignments (for MCQ, short-answer, long-answer)
    try {
      await connection.query('ALTER TABLE assignments ADD COLUMN questions JSON NULL');
      console.log('✅ Added questions to assignments');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ questions already exists in assignments');
      } else throw err;
    }

    // Migration: Add is_published to assignments (draft by default, instructor publishes later)
    try {
      await connection.query('ALTER TABLE assignments ADD COLUMN is_published TINYINT(1) DEFAULT 0');
      console.log('✅ Added is_published to assignments');
      await connection.query('UPDATE assignments SET is_published = 1');
      console.log('✅ Backfilled existing assignments as published');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ is_published already exists in assignments');
      } else throw err;
    }

    // Migration: Add password reset token for forgot-password flow
    try {
      await connection.query('ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(64) NULL');
      console.log('✅ Added password_reset_token to users');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ password_reset_token already exists in users');
      } else throw err;
    }
    try {
      await connection.query('ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL');
      console.log('✅ Added password_reset_expires to users');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('⏭️ password_reset_expires already exists in users');
      } else throw err;
    }

    // Migration: Support tickets table (Help & Support form)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS support_tickets (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          subject VARCHAR(255) NOT NULL,
          category VARCHAR(64) NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_created (created_at),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created support_tickets table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⏭️ support_tickets table already exists');
      } else throw err;
    }

    // Migration: Chat tables (conversations + messages)
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_updated_at (updated_at)
        )
      `);
      console.log('✅ Created conversations table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⏭️ conversations table already exists');
      } else throw err;
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id INT NOT NULL,
          user_id INT NOT NULL,
          last_read_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, user_id),
          INDEX idx_user_id (user_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created conversation_participants table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⏭️ conversation_participants table already exists');
      } else throw err;
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          conversation_id INT NOT NULL,
          sender_id INT NOT NULL,
          content TEXT NOT NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_conversation_created (conversation_id, created_at),
          INDEX idx_sender_id (sender_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created messages table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') {
        console.log('⏭️ messages table already exists');
      } else throw err;
    }

    // Quiz exam: time window, questions JSON, attempts + proctor logs
    try {
      await connection.query(
        'ALTER TABLE quizzes ADD COLUMN available_from DATETIME NULL'
      );
      console.log('✅ Added available_from to quizzes');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') console.log('⏭️ available_from already exists in quizzes');
      else throw err;
    }
    try {
      await connection.query(
        'ALTER TABLE quizzes ADD COLUMN available_until DATETIME NULL'
      );
      console.log('✅ Added available_until to quizzes');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') console.log('⏭️ available_until already exists in quizzes');
      else throw err;
    }
    try {
      await connection.query(
        'ALTER TABLE quizzes ADD COLUMN questions_json JSON NULL'
      );
      console.log('✅ Added questions_json to quizzes');
    } catch (err: any) {
      if (err.code === 'ER_DUP_FIELDNAME') console.log('⏭️ questions_json already exists in quizzes');
      else throw err;
    }

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS quiz_attempts (
          id INT PRIMARY KEY AUTO_INCREMENT,
          quiz_id INT NOT NULL,
          user_id INT NOT NULL,
          tab_lock_id VARCHAR(64) NULL,
          answers_json JSON NULL,
          logs_json JSON NULL,
          score INT NULL,
          correct_count INT NULL,
          wrong_count INT NULL,
          started_at DATETIME NOT NULL,
          submitted_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_quiz_user (quiz_id, user_id),
          INDEX idx_user (user_id),
          FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created quiz_attempts table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') console.log('⏭️ quiz_attempts already exists');
      else throw err;
    }

    // Migration: Rebuild quiz_attempts if it has the old schema (missing answers_json)
    try {
      const [cols] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quiz_attempts' AND COLUMN_NAME = 'answers_json'`
      ) as any[];
      if (!Array.isArray(cols) || cols.length === 0) {
        console.log('🔄 quiz_attempts has old schema — rebuilding...');
        await connection.query('DROP TABLE IF EXISTS quiz_attempts');
        await connection.query(`
          CREATE TABLE quiz_attempts (
            id            INT PRIMARY KEY AUTO_INCREMENT,
            quiz_id       INT NOT NULL,
            user_id       INT NOT NULL,
            tab_lock_id   VARCHAR(128) NULL,
            answers_json  LONGTEXT NULL,
            logs_json     LONGTEXT NULL,
            score         DECIMAL(8,2) NULL,
            correct_count INT NULL,
            wrong_count   INT NULL,
            started_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            submitted_at  TIMESTAMP NULL,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_qa_quiz (quiz_id),
            INDEX idx_qa_user (user_id),
            INDEX idx_qa_quiz_user (quiz_id, user_id)
          )
        `);
        console.log('✅ Rebuilt quiz_attempts with correct schema');
      } else {
        console.log('⏭️ quiz_attempts schema already up to date');
      }
    } catch (err: any) {
      throw err;
    }

    // AI Summaries table for storing generated summaries
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ai_summaries (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          course_id INT NULL,
          lesson_id INT NULL,
          title VARCHAR(255) NOT NULL,
          original_content LONGTEXT NULL,
          original_content_length INT NULL,
          short_summary LONGTEXT NOT NULL,
          key_points JSON NULL,
          study_notes LONGTEXT NULL,
          word_count INT NOT NULL DEFAULT 0,
          reading_time VARCHAR(64) NOT NULL DEFAULT '0 min',
          content_type VARCHAR(64) DEFAULT 'text',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id),
          INDEX idx_course_id (course_id),
          INDEX idx_lesson_id (lesson_id),
          INDEX idx_created_at (created_at),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Created ai_summaries table');
    } catch (err: any) {
      if (err.code === 'ER_TABLE_EXISTS_ERROR') console.log('⏭️ ai_summaries table already exists');
      else throw err;
    }

    console.log('🎯 Migrations complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
};

runMigrations();
