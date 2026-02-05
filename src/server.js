require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');
const emailService = require('./services/emailService');

const PORT = process.env.PORT || 3000;

let server;

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('MongoDB conectado');

    // Conectar a Redis (no crítico si falla)
    try {
      await connectRedis();
      console.log('Redis conectado');
    } catch (error) {
      console.warn('Redis no disponible. El sistema funcionará sin caché:', error.message);
    }

    // Inicializar servicio de email
    try {
      await emailService.initialize();
      console.log('Servicio de email inicializado');
    } catch (error) {
      console.warn('Servicio de email no disponible:', error.message);
    }

    // Iniciar servidor
    server = app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
      
      console.log(`
╔════════════════════════════════════════════════════════╗
║   SISTEMA DE GESTIÓN DE TALLER MECÁNICO               ║
║   Puerto: ${PORT}                                         ║
║   Entorno: ${process.env.NODE_ENV || 'development'}                               ║
║   Health: http://localhost:${PORT}/health                 ║
║   API: http://localhost:${PORT}/api                       ║
╚════════════════════════════════════════════════════════╝
      `);
    });

  } catch (error) {
    console.error('Error al iniciar el servidor:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`Señal ${signal} recibida. Cerrando servidor...`);

  if (server) {
    server.close(async () => {
      console.log('Servidor HTTP cerrado');

      // Cerrar conexiones
      await disconnectDB();
      await disconnectRedis();

      console.log('Todas las conexiones cerradas. Saliendo...');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.error('No se pudo cerrar correctamente. Forzando salida...');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Manejo de señales de terminación
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Excepción no capturada:', error.message);
  console.error(error.stack);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  shutdown('unhandledRejection');
});

// Iniciar servidor
startServer();