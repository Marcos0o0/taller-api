const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('Auth API Integration Tests', () => {
  let adminToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taller-test');
    
    // Create admin user for tests
    await User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.username).toBe('admin');
      
      adminToken = res.body.data.accessToken;
    });

    it('should fail with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should fail with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('admin');
    });

    it('should fail without token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('cerrada');
    });
  });
});