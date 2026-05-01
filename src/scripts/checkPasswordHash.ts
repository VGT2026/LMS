import { comparePassword } from '../utils/auth';

const checkPasswordHash = async () => {
  const hash = '$2b$12$cu0uSeZGVre8KHkB/0Hw9e9K2C9ppxvINTjDi2ox5b5lQO8SImal6';

  console.log('🔍 Checking password hash...');
  console.log('Hash:', hash);
  console.log('');

  const passwords = ['admin123', 'password123', 'admin', 'password', '123456', 'lmsadmin'];

  console.log('Testing common passwords:');
  for (const pwd of passwords) {
    const isValid = await comparePassword(pwd, hash);
    console.log(`Password '${pwd}': ${isValid ? '✅ MATCHES' : '❌ NO MATCH'}`);
  }

  console.log('');
  console.log('This hash is used for the admin user in your LMS system.');
};

checkPasswordHash();