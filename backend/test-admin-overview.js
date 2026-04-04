const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyYjk3MDAwMC1lMDVkLTQ4OTctODE4ZS0yYjYxNmYxNTU5OGUiLCJ0ZW5hbnRJZCI6bnVsbCwicm9sZSI6IlBMQVRGT1JNX0FETUlOIiwiaWF0IjoxNzc0ODE4NTk2LCJleHAiOjE3NzQ5MDQ5OTZ9.B__R0ZPqi1YZz1chvEGGMrPBHoyhIOoUYlEZqLeac6g';

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/admin/overview',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
  }
};

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(body);
        console.log('\n✅ Admin Overview API Working!');
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Response:', body);
      }
    } else {
      console.log(`❌ Error Status ${res.statusCode}`);
      console.log('Response:', body);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.end();
