// Simple test using built-in fetch
const testRegistration = async () => {
  try {
    console.log('🧪 Testing Student Registration...');

    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Student',
        email: 'test.student@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', data);

    if (data.success) {
      console.log('✅ Registration successful!');
    } else {
      console.log('❌ Registration failed:', data.message);
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
};

testRegistration();