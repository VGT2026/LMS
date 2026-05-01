import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testPassword = async () => {
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

    // Get admin password hash
    const [adminUsers] = await connection.query(
      'SELECT password FROM users WHERE email = ?',
      ['admin@lmspro.com']
    );

    if (Array.isArray(adminUsers) && adminUsers.length > 0) {
      const storedHash = (adminUsers[0] as any).password;
      console.log('Stored hash:', storedHash);

      // Test password verification
      const testPassword = 'admin123';
      const isValid = await bcrypt.compare(testPassword, storedHash);

      console.log('Testing password "admin123":', isValid ? '✅ VALID' : '❌ INVALID');

      // Also test hashing the same password to see if it matches
      const saltRounds = 12;
      const newHash = await bcrypt.hash(testPassword, saltRounds);
      console.log('New hash for "admin123":', newHash.substring(0, 20) + '...');

      const isSame = storedHash === newHash;
      console.log('Hashes match:', isSame ? '✅ SAME' : '❌ DIFFERENT');

      // Test if the new hash works
      const isNewValid = await bcrypt.compare(testPassword, newHash);
      console.log('New hash verification:', isNewValid ? '✅ WORKS' : '❌ FAILS');
    }

  } catch (error) {
    console.error('❌ Password test failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run test
testPassword();