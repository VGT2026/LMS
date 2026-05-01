import { hashPassword, comparePassword } from '../utils/auth';

const testHash = async () => {
  try {
    console.log('🧪 Testing Password Hashing...');

    const password = 'admin123';
    console.log('Original password:', password);

    // Hash the password
    const hashed = await hashPassword(password);
    console.log('Hashed password:', hashed);
    console.log('Hash length:', hashed.length);

    // Verify the password
    const isValid = await comparePassword(password, hashed);
    console.log('Password verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');

    // Test wrong password
    const isWrongValid = await comparePassword('wrongpassword', hashed);
    console.log('Wrong password verification:', isWrongValid ? '❌ UNEXPECTED' : '✅ CORRECT');

  } catch (error) {
    console.error('❌ Hash test failed:', error);
  }
};

// Run test
testHash();