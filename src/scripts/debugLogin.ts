import { UserModel } from '../models/User';
import { comparePassword } from '../utils/auth';

const debugLogin = async () => {
  try {
    console.log('🔍 Debugging Admin Login...');

    // Find admin user
    const user = await UserModel.findByEmail('admin@lmspro.com');

    if (!user) {
      console.log('❌ Admin user not found in database');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('  ID:', user.id);
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Active:', user.is_active);
    console.log('  Password hash exists:', !!user.password);
    console.log('  Password hash length:', user.password.length);
    console.log('  Password hash preview:', user.password.substring(0, 20) + '...');

    // Test password verification
    const testPassword = 'admin123';
    console.log('\n🧪 Testing password verification...');
    console.log('  Test password:', testPassword);

    const isValid = await comparePassword(testPassword, user.password);
    console.log('  Password valid:', isValid ? '✅ YES' : '❌ NO');

    if (!isValid) {
      // Try a few more tests
      console.log('\n🔄 Trying alternative approaches...');

      // Test with different password
      const altPassword = 'admin123';
      const altValid = await comparePassword(altPassword, user.password);
      console.log('  Alternative test:', altValid ? '✅ YES' : '❌ NO');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
};

// Run debug
debugLogin();