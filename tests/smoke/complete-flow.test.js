const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Quote = require('../../src/models/Quote');
const WorkOrder = require('../../src/models/WorkOrder');
const Mechanic = require('../../src/models/Mechanic');

describe('Complete Flow Smoke Test', () => {
  let adminToken;
  let clientId;
  let quoteId;
  let orderId;
  let mechanicId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taller-test');
    
    // Setup: Create admin and mechanic
    const admin = await User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });

    const mechanicUser = await User.create({
      username: 'mechanic1',
      password: 'mech123',
      role: 'mechanic'
    });

    const mechanic = await Mechanic.create({
      userId: mechanicUser._id,
      firstName: 'Test',
      lastName1: 'Mechanic',
      phone: '+56912345678'
    });

    mechanicId = mechanic._id;

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    
    adminToken = loginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Quote.deleteMany({});
    await WorkOrder.deleteMany({});
    await Mechanic.deleteMany({});
    await mongoose.connection.close();
  });

  it('1. Should create a client', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Test',
        lastName1: 'Client',
        email: 'test@example.com',
        phone: '+56987654321'
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    clientId = res.body.data.client._id;
  });

  it('2. Should create a quote for the client', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        clientId,
        vehicle: {
          brand: 'Toyota',
          model: 'Corolla',
          year: 2020,
          licensePlate: 'TEST123',
          mileage: 50000
        },
        description: 'Test description with more than twenty characters to pass validation',
        proposedWork: 'Test proposed work with more than twenty characters as required',
        estimatedCost: 100000
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    quoteId = res.body.data.quote._id;
  });

  it('3. Should approve quote and create order automatically', async () => {
    const res = await request(app)
      .put(`/api/quotes/${quoteId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order).toBeDefined();
    orderId = res.body.data.order._id;
  });

  it('4. Should assign mechanic to order', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mechanicId: mechanicId.toString() })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('5. Should update order status to en_progreso', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'en_progreso',
        notes: 'Starting work'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('en_progreso');
  });

  it('6. Should update order status to listo', async () => {
    const res = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'listo',
        notes: 'Work completed'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order.status).toBe('listo');
  });

  it('7. Should get dashboard stats', async () => {
    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.clients.total).toBeGreaterThan(0);
    expect(res.body.data.orders.total).toBeGreaterThan(0);
  });

  it('8. Should get client history', async () => {
    const res = await request(app)
      .get(`/api/clients/${clientId}/history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.quotes.length).toBeGreaterThan(0);
    expect(res.body.data.orders.length).toBeGreaterThan(0);
  });
});