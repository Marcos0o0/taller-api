require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Client = require('../models/Client');
const Mechanic = require('../models/Mechanic');
const Quote = require('../models/Quote');
const WorkOrder = require('../models/WorkOrder');

const seedData = async () => {
  try {
    // Conectar a MongoDB
    console.log('📦 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Preguntar si desea limpiar datos existentes
    console.log('\n⚠️  Este script eliminará TODOS los datos existentes.');
    console.log('Limpiando datos anteriores...\n');

    // Limpiar colecciones
    await User.deleteMany({});
    await Client.deleteMany({});
    await Mechanic.deleteMany({});
    await Quote.deleteMany({});
    await WorkOrder.deleteMany({});
    console.log('✅ Datos anteriores eliminados\n');

    // ============================================
    // 1. CREAR USUARIOS
    // ============================================
    console.log('👤 Creando usuarios...');
    
    const admin = await User.create({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });
    console.log('  ✅ Admin creado');

    const mechanicUser1 = await User.create({
      username: 'mechanic1',
      password: 'mech123',
      role: 'mechanic'
    });
    console.log('  ✅ Mecánico 1 creado');

    const mechanicUser2 = await User.create({
      username: 'mechanic2',
      password: 'mech123',
      role: 'mechanic'
    });
    console.log('  ✅ Mecánico 2 creado\n');

    // ============================================
    // 2. CREAR PERFILES DE MECÁNICOS
    // ============================================
    console.log('🔧 Creando perfiles de mecánicos...');
    
    const mechanic1 = await Mechanic.create({
      userId: mechanicUser1._id,
      firstName: 'Carlos',
      lastName1: 'Rodríguez',
      lastName2: 'Silva',
      phone: '+56912345678',
      isActive: true
    });
    console.log('  ✅ Carlos Rodríguez');

    const mechanic2 = await Mechanic.create({
      userId: mechanicUser2._id,
      firstName: 'Miguel',
      lastName1: 'Sánchez',
      lastName2: 'Torres',
      phone: '+56923456789',
      isActive: true
    });
    console.log('  ✅ Miguel Sánchez\n');

    // ============================================
    // 3. CREAR CLIENTES
    // ============================================
    console.log('👥 Creando clientes...');
    
    const clients = await Client.create([
      {
        firstName: 'Juan',
        lastName1: 'Pérez',
        lastName2: 'González',
        email: 'juan.perez@email.com',
        phone: '+56912345678'
      },
      {
        firstName: 'María',
        lastName1: 'López',
        lastName2: 'Martínez',
        email: 'maria.lopez@email.com',
        phone: '+56987654321'
      },
      {
        firstName: 'Pedro',
        lastName1: 'Ramírez',
        email: 'pedro.ramirez@email.com',
        phone: '+56923456789'
      },
      {
        firstName: 'Ana',
        lastName1: 'Torres',
        lastName2: 'Muñoz',
        email: 'ana.torres@email.com',
        phone: '+56934567890'
      },
      {
        firstName: 'Luis',
        lastName1: 'Fernández',
        email: 'luis.fernandez@email.com',
        phone: '+56945678901'
      },
      {
        firstName: 'Carmen',
        lastName1: 'Vega',
        lastName2: 'Rojas',
        email: 'carmen.vega@email.com',
        phone: '+56956789012'
      }
    ]);
    console.log(`  ✅ ${clients.length} clientes creados\n`);

    // ============================================
    // 4. CREAR PRESUPUESTOS DE EJEMPLO
    // ============================================
    console.log('📋 Creando presupuestos de ejemplo...');
    
    const quote1 = await Quote.create({
      clientId: clients[0]._id,
      vehicle: {
        brand: 'Toyota',
        model: 'Corolla',
        year: 2020,
        licensePlate: 'ABCD12',
        mileage: 50000
      },
      description: 'El vehículo presenta ruidos extraños en el motor al acelerar y la luz de check engine está encendida',
      proposedWork: 'Revisión completa del motor, diagnóstico con scanner, cambio de aceite y filtros, revisión del sistema de inyección',
      estimatedCost: 150000,
      status: 'pending'
    });
    console.log('  ✅ Presupuesto 1 (Pendiente)');

    const quote2 = await Quote.create({
      clientId: clients[1]._id,
      vehicle: {
        brand: 'Chevrolet',
        model: 'Spark',
        year: 2019,
        licensePlate: 'WXYZ34',
        mileage: 35000
      },
      description: 'Problemas con el sistema de frenos, pedal esponjoso y ruido al frenar',
      proposedWork: 'Cambio de pastillas y discos de freno, purga del sistema hidráulico, revisión de cilindros',
      estimatedCost: 180000,
      status: 'approved'
    });
    console.log('  ✅ Presupuesto 2 (Aprobado)');

    // ============================================
    // 5. CREAR ORDEN DE TRABAJO DE EJEMPLO
    // ============================================
    console.log('\n🔨 Creando órdenes de trabajo...');
    
    const order1 = await WorkOrder.create({
      quoteId: quote2._id,
      mechanicId: mechanic1._id,
      vehicleSnapshot: quote2.vehicle,
      workDescription: `${quote2.description}\n\nTrabajo propuesto:\n${quote2.proposedWork}`,
      estimatedCost: quote2.estimatedCost,
      finalCost: 185000,
      status: 'en_progreso',
      additionalNotes: 'Cliente aprobó trabajos adicionales'
    });
    console.log('  ✅ Orden 1 (En Progreso) - Asignada a Carlos\n');

    // Vincular orden al presupuesto
    quote2.workOrderId = order1._id;
    await quote2.save();

    // ============================================
    // RESUMEN
    // ============================================
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   ✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE     ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    console.log('📋 RESUMEN:\n');
    console.log('👤 Usuarios creados: 3');
    console.log('   • admin / admin123 (Administrador)');
    console.log('   • mechanic1 / mech123 (Mecánico)');
    console.log('   • mechanic2 / mech123 (Mecánico)\n');
    
    console.log('🔧 Mecánicos: 2');
    console.log('   • Carlos Rodríguez Silva');
    console.log('   • Miguel Sánchez Torres\n');
    
    console.log('👥 Clientes: ' + clients.length);
    console.log('   • juan.perez@email.com');
    console.log('   • maria.lopez@email.com');
    console.log('   • pedro.ramirez@email.com');
    console.log('   • ana.torres@email.com');
    console.log('   • luis.fernandez@email.com');
    console.log('   • carmen.vega@email.com\n');
    
    console.log('📋 Presupuestos: 2');
    console.log('   • 1 Pendiente (Toyota Corolla)');
    console.log('   • 1 Aprobado (Chevrolet Spark)\n');
    
    console.log('🔨 Órdenes: 1');
    console.log('   • 1 En Progreso (asignada a Carlos)\n');

    console.log('🚀 API disponible en: http://localhost:3001');
    console.log('📚 Usa Postman para probar los endpoints\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al crear datos de prueba:', error);
    process.exit(1);
  }
};

// Ejecutar seed
seedData();