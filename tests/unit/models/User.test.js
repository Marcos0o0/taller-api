const mongoose = require('mongoose');
const User = require('../../../src/models/User');

describe('User Model', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taller-test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        password: 'test123',
        role: 'admin'
      };

      const user = await User.create(userData);

      expect(user.username).toBe('testuser');
      expect(user.role).toBe('admin');
      expect(user.password).not.toBe('test123'); // Should be hashed
      expect(user.isDeleted).toBe(false);
    });

    it('should hash password before saving', async () => {
      const user = new User({
        username: 'testuser',
        password: 'plaintext'
      });

      await user.save();
      expect(user.password).not.toBe('plaintext');
      expect(user.password.length).toBeGreaterThan(20);
    });

    it('should fail without required fields', async () => {
      const user = new User({});
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should fail with duplicate username', async () => {
      await User.create({ username: 'testuser', password: 'test123' });
      
      await expect(
        User.create({ username: 'testuser', password: 'test456' })
      ).rejects.toThrow();
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const user = await User.create({
        username: 'testuser',
        password: 'test123'
      });

      const isValid = await user.verifyPassword('test123');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const user = await User.create({
        username: 'testuser',
        password: 'test123'
      });

      const isValid = await user.verifyPassword('wrongpassword');
      expect(isValid).toBe(false);
    });
  });

  describe('Account Locking', () => {
    it('should lock account after 5 failed attempts', async () => {
      const user = await User.create({
        username: 'testuser',
        password: 'test123'
      });

      // Simulate 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await user.incLoginAttempts();
        await user.save();
      }

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.isLocked()).toBe(true);
    });

    it('should reset login attempts on successful login', async () => {
      const user = await User.create({
        username: 'testuser',
        password: 'test123',
        loginAttempts: 3
      });

      await user.resetLoginAttempts();
      
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.loginAttempts).toBe(0);
    });
  });

  describe('Soft Delete', () => {
    it('should soft delete a user', async () => {
      const user = await User.create({
        username: 'testuser',
        password: 'test123'
      });

      const adminId = new mongoose.Types.ObjectId();
      await user.softDelete(adminId);

      expect(user.isDeleted).toBe(true);
      expect(user.deletedAt).toBeTruthy();
      expect(user.deletedBy.toString()).toBe(adminId.toString());
    });
  });
});