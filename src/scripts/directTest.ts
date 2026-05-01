import { hashPassword, comparePassword } from '../utils/auth';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const directTest = async () => {
  let connection: mysql.Connection | null = null;

  try {
    console.log('🔬 Direct Password Test...');

    // Test 1: Hash and verify directly (no database)
    console.log('\n1️⃣ Testing direct hash/verify:');
    const password = 'admin123';
    const hash1 = await hashPassword(password);
    const verify1 = await comparePassword(password, hash1);
    console.log('   Hash:', hash1.substring(0, 20) + '...');
    console.log('   Verify:', verify1 ? '✅ SUCCESS' : '❌ FAILED');

    // Test 2: Store in database and retrieve
    console.log('\n2️⃣ Testing database storage:');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lms_database',
    });

    // Create hash for database
    const hash2 = await hashPassword(password);
    console.log('   Hash for DB:', hash2.substring(0, 20) + '...');

    // Insert into database
    const insertResult = await connection.query(
      'INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      ['Test Admin', 'testadmin@test.com', hash2, 'admin', true]
    );
    console.log('   Insert result:', (insertResult[0] as any).insertId);

    // Retrieve from database
    const [rows] = await connection.query(
      'SELECT password FROM users WHERE email = ?',
      ['testadmin@test.com']
    );

    const retrievedHash = (rows as any[])[0].password;
    console.log('   Retrieved hash:', retrievedHash.substring(0, 20) + '...');
    console.log('   Hashes match:', hash2 === retrievedHash ? '✅ YES' : '❌ NO');

    // Test verification with retrieved hash
    const verify2 = await comparePassword(password, retrievedHash);
    console.log('   Verify retrieved:', verify2 ? '✅ SUCCESS' : '❌ FAILED');

    // Clean up
    await connection.query('DELETE FROM users WHERE email = ?', ['testadmin@test.com']);
    console.log('   Test user cleaned up');

  } catch (error) {
    console.error('❌ Direct test failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run direct test
directTest();