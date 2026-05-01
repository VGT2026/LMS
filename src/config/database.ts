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

const getDatabaseConfig = (): DatabaseConfig => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const url = new URL(databaseUrl);

    return {
      host: url.hostname,
      port: parseInt(url.port || '3306', 10),
      user: decodeURIComponent(url.username) || 'root',
      password: decodeURIComponent(url.password) || '',
      database: url.pathname?.slice(1) || process.env.DB_NAME || 'lms_database',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lms_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
};

const dbConfig: DatabaseConfig = getDatabaseConfig();

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
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    throw error;
  } finally {
    connection.release();
  }
};