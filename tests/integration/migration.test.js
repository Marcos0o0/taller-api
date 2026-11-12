const mongoose = require('mongoose');
const { spawnSync } = require('child_process');

test('migra índices antiguos en una copia y admite varios clientes sin correo', async () => {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const clients = mongoose.connection.collection('clients');
    await clients.deleteMany({});
    await clients.insertOne({ firstName: 'Preparación de copia' });
    await clients.dropIndexes();
    await clients.deleteMany({});
    await clients.createIndex({ email: 1 }, { unique: true });
    await clients.createIndex(
      { email: 1, isDeleted: 1 },
      { unique: true, partialFilterExpression: { isDeleted: false } }
    );
    await clients.insertOne({
      firstName: 'Histórico',
      phone: '912345678',
      email: 'antiguo@example.test',
      isDeleted: false,
    });
    const result = spawnSync(
      process.execPath,
      ['src/scripts/migrateBudgets.js', '--apply', '--database', mongoose.connection.name],
      { env: process.env, encoding: 'utf8', timeout: 15000 }
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    await clients.insertMany([
      { firstName: 'Sin correo uno', isDeleted: false },
      { firstName: 'Sin correo dos', isDeleted: false },
    ]);
    expect(await clients.countDocuments({ firstName: 'Histórico' })).toBe(1);
    expect((await clients.indexes()).some((index) => index.name === 'client_email_active')).toBe(
      true
    );
  } finally {
    await mongoose.connection.collection('clients').deleteMany({});
    await mongoose.disconnect();
  }
}, 20000);
