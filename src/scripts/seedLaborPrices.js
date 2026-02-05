// scripts/seedLaborPrices.js

const mongoose = require('mongoose');
const { LaborPrice, ServiceCategory } = require('../models/laborPrice.model');

// Conectar a la base de datos
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taller-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado a MongoDB');
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB:', error);
    process.exit(1);
  }
};

// Datos de seed
const categoriesData = [
  {
    name: 'Motor',
    description: 'Servicios relacionados con el motor del vehículo',
    icon: 'SettingOutlined',
    color: '#ff4d4f',
    order: 1,
  },
  {
    name: 'Sistema de Frenos',
    description: 'Mantenimiento y reparación de frenos',
    icon: 'FireOutlined',
    color: '#fa8c16',
    order: 2,
  },
  {
    name: 'Suspensión',
    description: 'Servicios de suspensión y dirección',
    icon: 'ApiOutlined',
    color: '#1890ff',
    order: 3,
  },
  {
    name: 'Sistema Eléctrico',
    description: 'Reparaciones eléctricas y electrónicas',
    icon: 'ThunderboltOutlined',
    color: '#faad14',
    order: 4,
  },
  {
    name: 'Transmisión',
    description: 'Servicios de transmisión y embrague',
    icon: 'CarOutlined',
    color: '#722ed1',
    order: 5,
  },
  {
    name: 'Carrocería y Pintura',
    description: 'Trabajos de carrocería y pintura',
    icon: 'BulbOutlined',
    color: '#13c2c2',
    order: 6,
  },
];

const getServicesData = (categories) => [
  // Motor
  {
    name: 'Cambio de Aceite y Filtro',
    description: 'Incluye drenaje, cambio de filtro y relleno de aceite',
    estimatedTime: '30-45 min',
    priceRange: { min: 15000, max: 25000 },
    difficulty: 'Básico',
    notes: 'Precio no incluye aceite ni filtro',
    categoryId: categories.find((c) => c.name === 'Motor')._id,
  },
  {
    name: 'Cambio de Correa de Distribución',
    description: 'Incluye tensor y bomba de agua (recomendado)',
    estimatedTime: '3-5 horas',
    priceRange: { min: 80000, max: 150000 },
    difficulty: 'Avanzado',
    notes: 'Varía según modelo del vehículo',
    categoryId: categories.find((c) => c.name === 'Motor')._id,
  },
  {
    name: 'Cambio de Bujías',
    description: 'Reemplazo de bujías y limpieza',
    estimatedTime: '30-60 min',
    priceRange: { min: 15000, max: 30000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Motor')._id,
  },
  {
    name: 'Limpieza de Inyectores',
    description: 'Limpieza ultrasónica o química',
    estimatedTime: '2-3 horas',
    priceRange: { min: 40000, max: 70000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Motor')._id,
  },
  {
    name: 'Reparación de Culata',
    description: 'Desmontaje, rectificado y montaje',
    estimatedTime: '8-12 horas',
    priceRange: { min: 200000, max: 400000 },
    difficulty: 'Especializado',
    notes: 'No incluye repuestos ni rectificado externo',
    categoryId: categories.find((c) => c.name === 'Motor')._id,
  },

  // Sistema de Frenos
  {
    name: 'Cambio de Pastillas de Freno',
    description: 'Delanteras o traseras',
    estimatedTime: '1-1.5 horas',
    priceRange: { min: 20000, max: 35000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Sistema de Frenos')._id,
  },
  {
    name: 'Cambio de Discos de Freno',
    description: 'Incluye rectificado si es posible',
    estimatedTime: '1.5-2 horas',
    priceRange: { min: 30000, max: 50000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Sistema de Frenos')._id,
  },
  {
    name: 'Purgado de Sistema de Frenos',
    description: 'Cambio de líquido y purgado completo',
    estimatedTime: '1-1.5 horas',
    priceRange: { min: 20000, max: 30000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Sistema de Frenos')._id,
  },
  {
    name: 'Cambio de Bombín de Freno',
    description: 'Por rueda, incluye purgado',
    estimatedTime: '1-2 horas',
    priceRange: { min: 25000, max: 40000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Sistema de Frenos')._id,
  },

  // Suspensión
  {
    name: 'Cambio de Amortiguadores',
    description: 'Por eje (delantero o trasero)',
    estimatedTime: '2-3 horas',
    priceRange: { min: 40000, max: 70000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Suspensión')._id,
  },
  {
    name: 'Cambio de Rótulas',
    description: 'Superiores o inferiores',
    estimatedTime: '1.5-2.5 horas',
    priceRange: { min: 30000, max: 50000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Suspensión')._id,
  },
  {
    name: 'Alineación y Balanceo',
    description: 'Alineación 4 ruedas y balanceo',
    estimatedTime: '1-1.5 horas',
    priceRange: { min: 25000, max: 35000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Suspensión')._id,
  },
  {
    name: 'Cambio de Bujes de Suspensión',
    description: 'Set completo por eje',
    estimatedTime: '2-4 horas',
    priceRange: { min: 50000, max: 90000 },
    difficulty: 'Avanzado',
    categoryId: categories.find((c) => c.name === 'Suspensión')._id,
  },

  // Sistema Eléctrico
  {
    name: 'Cambio de Batería',
    description: 'Instalación y verificación del sistema',
    estimatedTime: '20-30 min',
    priceRange: { min: 10000, max: 15000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Sistema Eléctrico')._id,
  },
  {
    name: 'Cambio de Alternador',
    description: 'Desmontaje e instalación',
    estimatedTime: '1.5-3 horas',
    priceRange: { min: 35000, max: 60000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Sistema Eléctrico')._id,
  },
  {
    name: 'Cambio de Motor de Arranque',
    description: 'Desmontaje e instalación',
    estimatedTime: '1-2 horas',
    priceRange: { min: 30000, max: 50000 },
    difficulty: 'Intermedio',
    categoryId: categories.find((c) => c.name === 'Sistema Eléctrico')._id,
  },
  {
    name: 'Diagnóstico con Scanner',
    description: 'Lectura y borrado de códigos',
    estimatedTime: '30-60 min',
    priceRange: { min: 15000, max: 25000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Sistema Eléctrico')._id,
  },
  {
    name: 'Instalación de Alarma',
    description: 'Incluye configuración y pruebas',
    estimatedTime: '2-4 horas',
    priceRange: { min: 40000, max: 80000 },
    difficulty: 'Avanzado',
    categoryId: categories.find((c) => c.name === 'Sistema Eléctrico')._id,
  },

  // Transmisión
  {
    name: 'Cambio de Embrague',
    description: 'Kit completo: disco, plato y collarin',
    estimatedTime: '4-6 horas',
    priceRange: { min: 100000, max: 180000 },
    difficulty: 'Avanzado',
    categoryId: categories.find((c) => c.name === 'Transmisión')._id,
  },
  {
    name: 'Cambio de Aceite de Caja',
    description: 'Manual o automática',
    estimatedTime: '45-90 min',
    priceRange: { min: 20000, max: 35000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Transmisión')._id,
  },
  {
    name: 'Reparación de Caja de Cambios',
    description: 'Desmontaje, reparación y montaje',
    estimatedTime: '10-15 horas',
    priceRange: { min: 250000, max: 500000 },
    difficulty: 'Especializado',
    notes: 'No incluye repuestos internos',
    categoryId: categories.find((c) => c.name === 'Transmisión')._id,
  },

  // Carrocería y Pintura
  {
    name: 'Pulido Óptico de Faros',
    description: 'Restauración de transparencia',
    estimatedTime: '1-2 horas',
    priceRange: { min: 20000, max: 40000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Carrocería y Pintura')._id,
  },
  {
    name: 'Cambio de Parachoque',
    description: 'Desmontaje e instalación',
    estimatedTime: '1-2 horas',
    priceRange: { min: 25000, max: 45000 },
    difficulty: 'Básico',
    categoryId: categories.find((c) => c.name === 'Carrocería y Pintura')._id,
  },
  {
    name: 'Pintura de Pieza',
    description: 'Preparación y pintura de una pieza',
    estimatedTime: '4-8 horas',
    priceRange: { min: 80000, max: 150000 },
    difficulty: 'Avanzado',
    notes: 'No incluye materiales de pintura',
    categoryId: categories.find((c) => c.name === 'Carrocería y Pintura')._id,
  },
  {
    name: 'Desabolladura sin Pintura',
    description: 'PDR (Paintless Dent Repair)',
    estimatedTime: '1-3 horas',
    priceRange: { min: 30000, max: 80000 },
    difficulty: 'Especializado',
    categoryId: categories.find((c) => c.name === 'Carrocería y Pintura')._id,
  },
];

// Función principal de seed
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seed de base de datos...');

    // Limpiar datos existentes
    console.log('🗑️  Limpiando datos existentes...');
    await LaborPrice.deleteMany({});
    await ServiceCategory.deleteMany({});

    // Crear categorías
    console.log('📁 Creando categorías...');
    const categories = await ServiceCategory.insertMany(categoriesData);
    console.log(`✅ ${categories.length} categorías creadas`);

    // Crear servicios
    console.log('🔧 Creando servicios...');
    const servicesData = getServicesData(categories);
    const services = await LaborPrice.insertMany(servicesData);
    console.log(`✅ ${services.length} servicios creados`);

    console.log('🎉 Seed completado exitosamente!');
    console.log('\nResumen:');
    console.log(`- Categorías: ${categories.length}`);
    console.log(`- Servicios: ${services.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  }
};

// Ejecutar seed
if (require.main === module) {
  connectDB().then(seedDatabase);
}

module.exports = { seedDatabase };