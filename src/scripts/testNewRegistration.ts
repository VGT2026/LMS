// Test new student registration
const testNewRegistration = async () => {
  try {
    console.log('🧪 Testing New Student Registration...');

    const response = await fetch('http://localhost:3001/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'New Student',
        email: 'new.student@example.com',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', data);

    if (data.success) {
      console.log('✅ New student registration successful!');
      console.log('👤 User:', data.data.user.name, `(${data.data.user.email})`);
    } else {
      console.log('❌ Registration failed:', data.message);
    }

  } catch (error) {
    console.error('❌ Network error:', error);
  }
};

testNewRegistration();