const axios = require('axios');

async function testWithdrawal() {
  const api = axios.create({ baseURL: 'http://localhost:5000/api' });
  
  // 1. Login (assuming we have a way to get a token)
  // For this test, I'll skip actual auth and just check if the logic in the controller is sound by inspecting the code again.
  // BUT, I can try to hit the health check.
  try {
    const health = await api.get('/health');
    console.log('Backend Health:', health.data);
  } catch (e) {
    console.error('Backend unreachable');
  }
}

testWithdrawal();
