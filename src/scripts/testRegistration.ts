import { API_ORIGIN } from './apiOrigin';

const API_BASE = `${API_ORIGIN}/api`;

async function testRegistration() {
  try {
    console.log('🧪 Testing student registration...');

    const registrationData = {
      name: 'Test Student',
      email: 'teststudent@example.com',
      password: 'testpass123',
      confirmPassword: 'testpass123'
    };

    console.log('📤 Sending registration request...');
    console.log('Data:', registrationData);

    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationData),
    });

    const responseText = await response.text();
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('📥 Response body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('✅ Registration successful!');
      console.log('User:', data.data.user);
      console.log('Token:', data.data.token ? 'Present' : 'Missing');

      // Test login with the created user
      console.log('\n🔐 Testing login with created user...');
      const loginResponse = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registrationData.email,
          password: registrationData.password
        }),
      });

      const loginResponseText = await loginResponse.text();
      console.log('📥 Login response status:', loginResponse.status);
      console.log('📥 Login response body:', loginResponseText);

      if (loginResponse.ok) {
        console.log('✅ Login successful!');
      } else {
        console.log('❌ Login failed!');
      }
    } else {
      console.log('❌ Registration failed!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRegistration();
