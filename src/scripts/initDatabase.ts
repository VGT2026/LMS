import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
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

const initDatabase = async () => {
  let connection: mysql.Connection | null = null;
  const dbConfig = getDatabaseConfig();

  try {
    // Create connection without specifying database
    connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    console.log('📡 Connected to MySQL server');

    // Create database if it doesn't exist
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``);
    console.log(`✅ Database ${dbConfig.database} created or already exists`);

    // Switch to the target database
    await connection.query(`USE \`${dbConfig.database}\``);

    // Read and execute schema file
    const schemaPath = path.join(__dirname, '../../database_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Remove comments from SQL
    const cleaned = schemaSQL
      .split('\n')
      .map(line => {
        const commentIdx = line.indexOf('--');
        return commentIdx >= 0 ? line.substring(0, commentIdx) : line;
      })
      .join('\n');

    // Split SQL commands and execute them
    const commands = cleaned
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && cmd.toUpperCase() !== 'COMMIT');

    let successCount = 0;
    let skipCount = 0;

    for (const command of commands) {
      try {
        await connection.query(command);
        successCount++;
      } catch (err: any) {
        // Skip non-critical errors like indexes on non-existent tables
        if (
          ((command.toUpperCase().includes('CREATE INDEX') || 
            command.toUpperCase().includes('ALTER TABLE')) && 
           err.code === 'ER_NO_SUCH_TABLE') ||
          err.code === 'ER_DUP_FIELDNAME' ||
          err.code === 'ER_DUP_KEYNAME'
        ) {
          skipCount++;
          console.log(`⏭️ Skipped non-critical error: ${err.sqlMessage}`);
        } else {
          throw err;
        }
      }
    }

    console.log(`✅ Database schema initialized successfully (${successCount} executed, ${skipCount} skipped)`);
    console.log('🎯 LMS Database is ready!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run initialization
initDatabase();