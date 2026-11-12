require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client');
const Quote = require('../models/Quote');
const Device = require('../models/Device');
const Counter = require('../models/Counter');

async function migrate() {
  const apply = process.argv.includes('--apply');
  const expected = process.argv[process.argv.indexOf('--database') + 1];
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
  try {
    const database = mongoose.connection.db;
    console.log(
      `Base de datos: ${database.databaseName}. Modo: ${apply ? 'aplicar' : 'solo revisión'}.`
    );
    if (apply && (!process.argv.includes('--database') || expected !== database.databaseName))
      throw new Error('Especifica --database con el nombre exacto de la base respaldada.');
    const duplicateEmails = await Client.collection
      .aggregate([
        { $match: { isDeleted: false, email: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'count' },
      ])
      .toArray();
    if (duplicateEmails.length)
      throw new Error(
        'Hay correos duplicados entre clientes activos. Resuélvelos antes de migrar.'
      );
    const indexes = await Client.collection.indexes();
    const legacyEmailIndexes = indexes.filter(
      (index) => ['email_1', 'email_1_isDeleted_1'].includes(index.name) && index.key.email === 1
    );
    console.log(`Índices antiguos de correo que se reemplazarán: ${legacyEmailIndexes.length}.`);
    if (!apply) {
      console.log(
        'Revisión terminada. Respalda y prueba en una copia antes de usar --apply --database NOMBRE.'
      );
      return;
    }
    // El índice nuevo queda activo antes de retirar los antiguos.
    await Client.createIndexes();
    for (const index of legacyEmailIndexes) await Client.collection.dropIndex(index.name);
    await Client.collection.updateMany(
      { $or: [{ email: '' }, { email: null }] },
      { $unset: { email: '' } }
    );
    await Quote.createIndexes();
    await Device.createIndexes();
    await Counter.createIndexes();
    console.log('Migración terminada. No se modificaron importes ni detalles históricos.');
  } finally {
    await mongoose.disconnect();
  }
}
if (require.main === module)
  migrate().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = migrate;
