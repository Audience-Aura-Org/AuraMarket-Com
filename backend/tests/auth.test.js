const request = require('supertest');
const app = require('../server'); // We need to export app from server.js

describe('Auth API', () => {
  it('should return 200 for public health check', async () => {
    const res = await request(app).get('/api/auth/health-check');
    // Note: We need to implement this endpoint or check another public one
    expect(res.status).toBe(200);
  });
});
