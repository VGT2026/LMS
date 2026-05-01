import mysql from 'mysql2/promise';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  waitForConnections: boolean;
  connectionLimit: number;
  queueLimit: number;
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;

const dbConfig: DatabaseConfig = {
  host:
    process.env.DB_HOST ||
    process.env.MYSQL_HOST ||
    parsedDatabaseUrl?.hostname ||
    'localhost',
  port: parseInt(
    process.env.DB_PORT ||
    process.env.MYSQL_PORT ||
    parsedDatabaseUrl?.port ||
    '3306'
  ),
  user:
    process.env.DB_USER ||
    process.env.MYSQL_USER ||
    parsedDatabaseUrl?.username ||
    'root',
  password:
    process.env.DB_PASSWORD ||
    process.env.MYSQL_PASSWORD ||
    parsedDatabaseUrl?.password ||
    '',
  database:
    process.env.DB_NAME ||
    process.env.MYSQL_DATABASE ||
    (parsedDatabaseUrl?.pathname ? parsedDatabaseUrl.pathname.replace(/\//g, '') : '') ||
    'lms_database',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export const createConnection = async () => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Database connected successfully');
    return connection;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

export const createPool = () => {
  try {
    const pool = mysql.createPool(dbConfig);
    console.log('✅ Database pool created successfully');
    return pool;
  } catch (error) {
    console.error('❌ Database pool creation failed:', error);
    throw error;
  }
};

// Export the pool for use in the application
export const pool = createPool();

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};
