import { API_ORIGIN } from './apiOrigin';

// Test admin login
const testAdminLogin = async () => {
  try {
    console.log('🧪 Testing Admin Login...');

    const response = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@lmspro.com',
        password: 'admin123'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Admin login successful!');
      console.log('👤 User:', data.data.user.name, `(${data.data.user.role})`);
      console.log('🔑 Token received:', data.data.token ? 'Yes' : 'No');

      // Test getting users with admin token
      console.log('\n🧪 Testing Admin Get Users...');
      const usersResponse = await fetch(`${API_ORIGIN}/api/auth/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.data.token}`
        }
      });

      const usersData = await usersResponse.json();
      if (usersData.success) {
        console.log('✅ Admin get users successful!');
        console.log(`👥 Total users: ${usersData.pagination.total}`);
        console.log(`📄 Page: ${usersData.pagination.page}, Limit: ${usersData.pagination.limit}`);
      } else {
        console.log('❌ Admin get users failed:', usersData.message);
      }
    } else {
      console.log('❌ Admin login failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Test student registration
const testStudentRegistration = async () => {
  try {
    console.log('\n🧪 Testing Student Registration...');

    const response = await fetch(`${API_ORIGIN}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Student',
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Student registration successful!');
      console.log('👤 User:', data.data.user.name, `(${data.data.user.role})`);
    } else {
      console.log('❌ Student registration failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Test instructor creation
const testInstructorCreation = async () => {
  try {
    console.log('\n🧪 Testing Instructor Creation...');

    // First login as admin
    const loginResponse = await fetch(`${API_ORIGIN}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@lmspro.com',
        password: 'admin123'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginData.success) {
      console.log('❌ Admin login failed for instructor creation');
      return;
    }

    // Create instructor
    const createResponse = await fetch(`${API_ORIGIN}/api/auth/admin/instructor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.data.token}`
      },
      body: JSON.stringify({
        name: 'Test Instructor',
        email: 'instructor@example.com',
        password: 'password123'
      })
    });

    const createData = await createResponse.json();

    if (createData.success) {
      console.log('✅ Instructor creation successful!');
      console.log('👨‍🏫 Instructor:', createData.data.instructor.name);
    } else {
      console.log('❌ Instructor creation failed:', createData.message);
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting LMS Backend API Tests\n');

  await testAdminLogin();
  await testStudentRegistration();
  await testInstructorCreation();

  console.log('\n🎯 All tests completed!');
};

runTests();
