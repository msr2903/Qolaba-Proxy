import request from 'supertest';
import app from '../src/index.js';

describe('GET /v1/models', () => {
  it('should return a 200 status and a non-empty models list', async () => {
    const res = await request(app).get('/v1/models');
    expect(res.status).toBe(200);
    // Expect the OpenAI-style response structure
    expect(res.body).toBeTruthy();
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});