require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Client = require('../models/Client');
const Mechanic = require('../models/Mechanic');
const Quote = require('../models/Quote');
const WorkOrder = require('../models/WorkOrder');
const SystemLog = require('../models/SystemLog');

const cleanDatabase = async () => {
  try {
    console.log('🧹 Limpiando base de datos...\n');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Obtener conteos antes de limpiar
    const counts = {
      users: await User.countDocuments(),
      clients: await Client.countDocuments(),
      mechanics: await Mechanic.countDocuments(),
      quotes: await Quote.countDocuments(),
      orders: await WorkOrder.countDocuments(),
      logs: await SystemLog.countDocuments()
    };

    console.log('📊 Registros encontrados:');
    console.log(`   • Usuarios: ${counts.users}`);
    console.log(`   • Clientes: ${counts.clients}`);
    console.log(`   • Mecánicos: ${counts.mechanics}`);
    console.log(`   • Presupuestos: ${counts.quotes}`);
    console.log(`   • Órdenes: ${counts.orders}`);
    console.log(`   • Logs: ${counts.logs}\n`);

    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    if (total === 0) {
      console.log('✨ La base de datos ya está vacía\n');
      process.exit(0);
    }

    console.log(`⚠️  Se eliminarán ${total} registros en total\n`);
    console.log('Procediendo con la limpieza...\n');

    // Limpiar todas las colecciones
    await Promise.all([
      User.deleteMany({}),
      Client.deleteMany({}),
      Mechanic.deleteMany({}),
      Quote.deleteMany({}),
      WorkOrder.deleteMany({}),
      SystemLog.deleteMany({})
    ]);

    console.log('✅ Base de datos limpiada exitosamente\n');
    
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   🧹 LIMPIEZA COMPLETADA                      ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    
    console.log('💡 Para crear datos de prueba ejecuta:');
    console.log('   docker-compose exec api npm run seed\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar base de datos:', error);
    process.exit(1);
  }
};

// Ejecutar limpieza
cleanDatabase();