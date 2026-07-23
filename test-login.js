// Using native fetch in Node 24

async function testLogin() {
  try {
    console.log('Testing login endpoint at http://localhost:4000/api/v1/auth/login...');
    const response = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@leadcrm.io',
        password: 'change-this-immediately'
      })
    });
    
    const data = await response.json();
    console.log('Status Code:', response.status);
    console.log('Response Body:', data);
  } catch (error) {
    console.error('Connection Error:', error.message);
  }
}

testLogin();
