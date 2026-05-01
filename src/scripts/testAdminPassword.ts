import { comparePassword, hashPassword } from '../utils/auth';

const testAdminPassword = async () => {
  console.log('🔐 Testing admin password verification...');

  const password = 'admin123';
  const storedHash = '$2b$12$cu0uSeZGVre8KHkB/0Hw9e9K2C9ppxvINTjDi2ox5b5lQO8SImal6';

  console.log('Password to test:', password);
  console.log('Stored hash:', storedHash);

  // Test direct comparison
  const isValid = await comparePassword(password, storedHash);
  console.log('Password verification result:', isValid ? '✅ SUCCESS' : '❌ FAILED');

  // Test hashing the same password again
  const newHash = await hashPassword(password);
  console.log('New hash for same password:', newHash);
  console.log('Hashes match:', storedHash === newHash ? '✅ YES' : '❌ NO');

  // Test comparing with new hash
  const isValidWithNewHash = await comparePassword(password, newHash);
  console.log('Verification with new hash:', isValidWithNewHash ? '✅ SUCCESS' : '❌ FAILED');
};

testAdminPassword();