const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, io } = require('../../src/app');
const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Vehicle = require('../../src/models/Vehicle');

test('los vehículos incluyen el nombre real del cliente en la lista y el detalle', async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const owner = await User.create({ username: 'vehicle_test_owner', password: 'password123', role: 'admin' });
  const client = await Client.create({ firstName: 'María José', lastName1: 'Fernández', lastName2: 'Montenegro', phone: '912345678' });
  const vehicle = await Vehicle.create({ patente: 'ABCD12', marca: 'Toyota', modelo: 'Corolla', año: 2020, cliente: client._id, kilometraje: 50000 });
  const token = jwt.sign({ userId: String(owner._id) }, process.env.JWT_SECRET);
  try {
    const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${token}`).expect(200);
    const detail = await request(app).get(`/api/vehicles/${vehicle._id}`).set('Authorization', `Bearer ${token}`).expect(200);
    for (const value of [list.body.data.vehicles.find(item => item._id === String(vehicle._id)), detail.body.data.vehicle]) {
      expect(value.cliente.firstName).toBe('María José');
      expect(value.cliente.lastName1).toBe('Fernández');
      expect(value.cliente.lastName2).toBe('Montenegro');
    }
  } finally {
    await Vehicle.deleteOne({ _id: vehicle._id });
    await Client.deleteOne({ _id: client._id });
    await User.deleteOne({ _id: owner._id });
    await mongoose.disconnect();
    io.close();
  }
}, 20000);
