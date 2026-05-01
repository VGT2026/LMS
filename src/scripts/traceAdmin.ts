import { UserModel } from '../models/User';
import { hashPassword, comparePassword } from '../utils/auth';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const traceAdmin = async () => {
  let connection: mysql.Connection | null = null;

  try {
    console.log('🔍 Tracing Admin Creation Process...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lms_database',
    });

    // Step 1: Create hash
    console.log('\n1️⃣ Creating hash...');
    const password = 'admin123';
    const hash = await hashPassword(password);
    console.log('   Password:', password);
    console.log('   Hash created:', hash);
    console.log('   Hash length:', hash.length);

    // Step 2: Verify hash works
    console.log('\n2️⃣ Verifying hash...');
    const verify = await comparePassword(password, hash);
    console.log('   Hash verification:', verify ? '✅ WORKS' : '❌ FAILS');

    // Step 3: Insert directly into database
    console.log('\n3️⃣ Inserting into database...');
    const insertResult = await connection.query(
      'INSERT INTO users (name, email, password, role, is_active, preferred_categories, completed_course_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['System Administrator', 'admin@lmspro.com', hash, 'admin', true, '[]', '[]']
    );
    const insertId = (insertResult[0] as any).insertId;
    console.log('   Insert ID:', insertId);

    // Step 4: Retrieve from database
    console.log('\n4️⃣ Retrieving from database...');
    const [rows] = await connection.query(
      'SELECT id, name, email, password, role, is_active FROM users WHERE id = ?',
      [insertId]
    );
    const retrievedUser = (rows as any[])[0];
    console.log('   Retrieved password hash:', retrievedUser.password);
    console.log('   Hashes match:', hash === retrievedUser.password ? '✅ YES' : '❌ NO');

    // Step 5: Test password verification with retrieved hash
    console.log('\n5️⃣ Testing verification with retrieved hash...');
    const finalVerify = await comparePassword(password, retrievedUser.password);
    console.log('   Final verification:', finalVerify ? '✅ SUCCESS' : '❌ FAILED');

    // Step 6: Test using UserModel.findByEmail
    console.log('\n6️⃣ Testing UserModel.findByEmail...');
    const modelUser = await UserModel.findByEmail('admin@lmspro.com');
    if (modelUser) {
      console.log('   Model password hash:', modelUser.password);
      console.log('   Model vs Direct match:', modelUser.password === retrievedUser.password ? '✅ YES' : '❌ NO');

      const modelVerify = await comparePassword(password, modelUser.password);
      console.log('   Model verification:', modelVerify ? '✅ SUCCESS' : '❌ FAILED');
    } else {
      console.log('   ❌ User not found by UserModel');
    }

    // Clean up
    await connection.query('DELETE FROM users WHERE id = ?', [insertId]);
    console.log('\n🧹 Test user cleaned up');

  } catch (error) {
    console.error('❌ Trace failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

// Run trace
traceAdmin();