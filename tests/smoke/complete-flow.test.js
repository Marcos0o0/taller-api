const request = require('supertest');
const mongoose = require('mongoose');
const { randomUUID } = require('crypto');
jest.mock('../../src/services/emailService', () => ({
  sendQuoteEmail: jest.fn().mockResolvedValue({ success: true }),
}));
const { app, io } = require('../../src/app');
const User = require('../../src/models/User');
const Client = require('../../src/models/Client');
const Quote = require('../../src/models/Quote');
const Device = require('../../src/models/Device');
const Counter = require('../../src/models/Counter');

let token;
let owner;
const line = { type: 'service', name: 'Cambio de aceite', quantity: 1, price: 10000 };
const api = (method, path) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
async function createClient(name = 'Cliente de prueba') {
  const result = await api('post', '/api/clients')
    .send({ firstName: name, phone: '912345678' })
    .expect(201);
  return result.body.data.client;
}
async function createQuote(extra = {}) {
  const client = await createClient();
  const result = await api('post', '/api/quotes')
    .send({ clientId: client._id, items: [line], ...extra })
    .expect(201);
  return result.body.data.quote;
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Client.init(), Quote.init(), Device.init()]);
  owner = await User.create({ username: 'flow_owner', password: 'password123', role: 'admin' });
  const result = await request(app)
    .post('/api/auth/login')
    .send({ username: 'flow_owner', password: 'password123' })
    .expect(200);
  token = result.body.data.accessToken;
});
afterEach(async () => {
  await Promise.all([
    Quote.deleteMany({}),
    Client.deleteMany({}),
    Device.deleteMany({}),
    Counter.deleteMany({}),
  ]);
});
afterAll(async () => {
  await User.deleteMany({ username: 'flow_owner' });
  await mongoose.disconnect();
  io.close();
});

test('permite varios clientes sin correo y un presupuesto sin vehículo', async () => {
  await createClient('Otro cliente');
  const quote = await createQuote({ estimatedCost: 1 });
  expect(quote.estimatedCost).toBe(11900);
  expect(quote.saldoPendiente).toBe(11900);
  expect(quote.items[0].name).toBe(line.name);
});

test('aceptar no crea una orden y editar importes devuelve a pendiente con historial', async () => {
  const quote = await createQuote();
  const accepted = await api('put', `/api/quotes/${quote._id}/approve`).send({}).expect(200);
  expect(accepted.body.data.quote.workOrder).toBeNull();
  const edited = await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: accepted.body.data.quote.version, items: [{ ...line, price: 20000 }] })
    .expect(200);
  expect(edited.body.data.quote.status).toBe('pending');
  expect(edited.body.data.quote.estimatedCost).toBe(23800);
  const history = await api('get', `/api/quotes/${quote._id}/history`).expect(200);
  expect(
    history.body.data.history.some(
      (entry) => entry.quote.status === 'approved' && entry.quote.estimatedCost === 11900
    )
  ).toBe(true);
  await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: quote.version, notes: 'Edición obsoleta' })
    .expect(409);
});

test('duplicar reinicia abonos y aceptación, admite mismo vehículo e idempotencia', async () => {
  const quote = await createQuote({
    vehicle: { licensePlate: 'ABCD12' },
    abonos: [{ amount: 1000 }],
  });
  await api('put', `/api/quotes/${quote._id}/approve`).send({}).expect(200);
  const requestId = randomUUID();
  const first = await api('post', `/api/quotes/${quote._id}/duplicate`)
    .send({ requestId })
    .expect(201);
  const retry = await api('post', `/api/quotes/${quote._id}/duplicate`)
    .send({ requestId })
    .expect(200);
  expect(first.body.data.quote._id).toBe(retry.body.data.quote._id);
  expect(first.body.data.quote.quoteNumber).not.toBe(quote.quoteNumber);
  expect(first.body.data.quote.status).toBe('pending');
  expect(first.body.data.quote.totalAbonos).toBe(0);
  expect(first.body.data.quote.vehicle.licensePlate).toBe('ABCD12');
});

test('papelera y restauración conservan número, aceptación y abonos', async () => {
  const quote = await createQuote({ abonos: [{ amount: 500 }] });
  await api('put', `/api/quotes/${quote._id}/approve`).send({}).expect(200);
  await api('delete', `/api/quotes/${quote._id}`).expect(200);
  const active = await api('get', '/api/quotes').expect(200);
  expect(active.body.data.quotes).toHaveLength(0);
  const trash = await api('get', '/api/quotes?trash=true').expect(200);
  expect(trash.body.data.quotes[0]._id).toBe(quote._id);
  const restored = await api('post', `/api/quotes/${quote._id}/restore`).send({}).expect(200);
  expect(restored.body.data.quote.quoteNumber).toBe(quote.quoteNumber);
  expect(restored.body.data.quote.status).toBe('approved');
  expect(restored.body.data.quote.totalAbonos).toBe(500);
});

test('recalcula saldo al editar y rechaza totales menores a los abonos', async () => {
  const quote = await createQuote({ abonos: [{ amount: 5000 }] });
  const edited = await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: quote.version, items: [{ ...line, price: 20000 }] })
    .expect(200);
  expect(edited.body.data.quote.saldoPendiente).toBe(18800);
  await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: edited.body.data.quote.version, items: [{ ...line, price: 100 }] })
    .expect(400);
});

test('conserva detalle antiguo largo y permite duplicarlo', async () => {
  const text = 'Revisión de motor y trabajos anteriores. '.repeat(150);
  const quote = await createQuote({ items: undefined, proposedWork: text, estimatedCost: 12345 });
  const copy = await api('post', `/api/quotes/${quote._id}/duplicate`)
    .send({ requestId: randomUUID() })
    .expect(201);
  expect(copy.body.data.quote.proposedWork).toBe(text);
  expect(copy.body.data.quote.estimatedCost).toBe(12345);
});

test('busca por nombre, teléfono, patente y número', async () => {
  const quote = await createQuote({ vehicle: { licensePlate: 'ZZXX11' } });
  for (const term of ['Cliente de prueba', '912345678', 'ZZXX11', quote.quoteNumber]) {
    const response = await api('get', `/api/quotes?search=${encodeURIComponent(term)}`).expect(200);
    expect(response.body.data.quotes.map((item) => item._id)).toContain(quote._id);
  }
});

test('numeración concurrente incluye los documentos eliminados', async () => {
  const client = await createClient();
  await Quote.collection.insertOne({
    quoteNumber: 'PRES-0950',
    isDeleted: true,
    clientId: new mongoose.Types.ObjectId(client._id),
  });
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      api('post', '/api/quotes').send({
        clientId: client._id,
        items: [line],
        requestId: randomUUID(),
      })
    )
  );
  expect(results.map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
  const numbers = results.map((response) => response.body.data.quote.quoteNumber);
  expect(new Set(numbers).size).toBe(5);
  expect(numbers.every((number) => Number(number.split('-')[1]) > 950)).toBe(true);
});

test('creación concurrente con la misma clave produce un solo documento', async () => {
  const client = await createClient();
  const payload = { clientId: client._id, items: [line], requestId: randomUUID() };
  const results = await Promise.all([
    api('post', '/api/quotes').send(payload),
    api('post', '/api/quotes').send(payload),
  ]);
  expect(results.every((response) => [200, 201].includes(response.status))).toBe(true);
  expect(results[0].body.data.quote._id).toBe(results[1].body.data.quote._id);
});

test('vinculación almacena solo hash y revocar impide nuevas solicitudes', async () => {
  const linked = await api('post', '/api/devices').send({ name: 'PC prueba' }).expect(201);
  const deviceToken = linked.body.data.token;
  const stored = await Device.findById(linked.body.data.device._id).select('+tokenHash').lean();
  expect(stored.tokenHash).not.toBe(deviceToken);
  await request(app).get('/api/quotes').set('Authorization', `Bearer ${deviceToken}`).expect(200);
  await request(app)
    .post('/api/devices')
    .set('Authorization', `Bearer ${deviceToken}`)
    .send({ name: 'Intruso' })
    .expect(403);
  await api('delete', `/api/devices/${stored._id}`).expect(200);
  await request(app).get('/api/quotes').set('Authorization', `Bearer ${deviceToken}`).expect(401);
  await request(app).get('/api/quotes').expect(401);
});

test('las órdenes anteriores son solo consulta', async () => {
  await api('put', `/api/orders/${new mongoose.Types.ObjectId()}`).send({}).expect(405);
});

test('reintentar la creación del cliente conserva una sola ficha', async () => {
  const payload = { firstName: 'Cliente sin correo', phone: '912345678', requestId: randomUUID() };
  const responses = await Promise.all([
    api('post', '/api/clients').send(payload),
    api('post', '/api/clients').send(payload),
  ]);
  expect(responses.every((response) => [200, 201].includes(response.status))).toBe(true);
  expect(responses[0].body.data.client._id).toBe(responses[1].body.data.client._id);
  expect(await Client.countDocuments({ firstName: payload.firstName })).toBe(1);
});

test('el texto generado corresponde a las líneas actuales y conserva el detalle original al convertir', async () => {
  const quote = await createQuote({
    items: undefined,
    proposedWork: 'Detalle anterior que debe conservarse',
    estimatedCost: 35000,
  });
  const result = await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: quote.version, items: [{ ...line, name: 'Trabajo corregido' }] })
    .expect(200);
  expect(result.body.data.quote.proposedWork).toContain('Trabajo corregido');
  expect(result.body.data.quote.legacyProposedWork).toBe('Detalle anterior que debe conservarse');
});

test('un enlace de aceptación anterior deja de servir después de cambiar el importe', async () => {
  const quote = await createQuote();
  const stored = await Quote.findById(quote._id);
  const tokens = stored.generateTokens();
  await stored.save();
  await api('put', `/api/quotes/${quote._id}`)
    .send({ expectedVersion: stored.version, items: [{ ...line, price: 20000 }] })
    .expect(200);
  await request(app)
    .get(`/api/quotes/${quote._id}/approve?token=${tokens.approveToken}`)
    .expect(400);
});

test('busca nombre completo y teléfonos con espacios sin interpretar signos como expresiones', async () => {
  const client = await api('post', '/api/clients')
    .send({ firstName: 'Ana', lastName1: 'Mendoza', phone: '+56 9 1234 5678' })
    .expect(201);
  await api('post', '/api/quotes')
    .send({ clientId: client.body.data.client._id, items: [line] })
    .expect(201);
  for (const term of ['Ana Mendoza', '912345678']) {
    const result = await api('get', `/api/quotes?search=${encodeURIComponent(term)}`).expect(200);
    expect(result.body.data.quotes).toHaveLength(1);
  }
  await api('get', '/api/clients?search=Juan%28').expect(200);
});

test('admite correo opcional con alias y permite quitarlo', async () => {
  const result = await api('post', '/api/clients')
    .send({ firstName: 'Cliente', phone: '912345678', email: 'nombre+alias@example.test' })
    .expect(201);
  const updated = await api('put', `/api/clients/${result.body.data.client._id}`)
    .send({ email: '' })
    .expect(200);
  expect(updated.body.data.client.email).toBeUndefined();
});

test('conserva aceptación al añadir una nota y la reinicia al cambiar cliente o vehículo', async () => {
  const quote = await createQuote({ vehicle: { licensePlate: 'ABCD12' } });
  const accepted = await api('put', `/api/quotes/${quote._id}/approve`).send({}).expect(200);
  const note = await api('put', `/api/quotes/${quote._id}`)
    .send({
      clientId: quote.clientId._id,
      notes: 'Llamar al cliente',
      expectedVersion: accepted.body.data.quote.version,
    })
    .expect(200);
  expect(note.body.data.quote.status).toBe('approved');
  const client = await createClient('Otro destinatario');
  const changed = await api('put', `/api/quotes/${quote._id}`)
    .send({ clientId: client._id, expectedVersion: note.body.data.quote.version })
    .expect(200);
  expect(changed.body.data.quote.status).toBe('pending');
  const again = await api('put', `/api/quotes/${quote._id}/approve`).send({}).expect(200);
  const vehicle = await api('put', `/api/quotes/${quote._id}`)
    .send({ vehicle: { licensePlate: 'ZZXX11' }, expectedVersion: again.body.data.quote.version })
    .expect(200);
  expect(vehicle.body.data.quote.status).toBe('pending');
});
