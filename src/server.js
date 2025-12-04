require('dotenv').config();
const app = require('./app');
const { connectDB, disconnectDB } = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');
const emailService = require('./services/emailService');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

let server;

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    logger.info('MongoDB conectado');

    // Conectar a Redis (no crítico si falla)
    try {
      await connectRedis();
      logger.info('Redis conectado');
    } catch (error) {
      logger.warn('Redis no disponible. El sistema funcionará sin caché', {
        module: 'server',
        action: 'redis_connection_warning',
        metadata: { error: error.message }
      });
    }

    // Inicializar servicio de email
    try {
      await emailService.initialize();
      logger.info('Servicio de email inicializado');
    } catch (error) {
      logger.warn('Servicio de email no disponible', {
        module: 'server',
        action: 'email_init_warning',
        metadata: { error: error.message }
      });
    }

    // Iniciar servidor
    server = app.listen(PORT, () => {
      logger.info(`Servidor corriendo en puerto ${PORT}`, {
        module: 'server',
        action: 'start',
        metadata: {
          port: PORT,
          nodeEnv: process.env.NODE_ENV,
          nodeVersion: process.version
        }
      });
      
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

    // Manejo de errores del servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Puerto ${PORT} ya está en uso`, {
          module: 'server',
          action: 'port_in_use',
          metadata: { port: PORT }
        });
      } else {
        logger.error('Error del servidor:', {
          module: 'server',
          action: 'server_error',
          metadata: { error: error.message }
        });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Error al iniciar el servidor:', {
      module: 'server',
      action: 'startup_error',
      metadata: { error: error.message, stack: error.stack }
    });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`Señal ${signal} recibida. Cerrando servidor...`, {
    module: 'server',
    action: 'shutdown_start',
    metadata: { signal }
  });

  if (server) {
    server.close(async () => {
      logger.info('Servidor HTTP cerrado', {
        module: 'server',
        action: 'http_closed'
      });

      // Cerrar conexiones
      await disconnectDB();
      await disconnectRedis();

      logger.info('Todas las conexiones cerradas. Saliendo...', {
        module: 'server',
        action: 'shutdown_complete'
      });

      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      logger.error('No se pudo cerrar correctamente. Forzando salida...', {
        module: 'server',
        action: 'forced_shutdown'
      });
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
  logger.error('Excepción no capturada:', {
    module: 'server',
    action: 'uncaught_exception',
    metadata: { error: error.message, stack: error.stack }
  });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', {
    module: 'server',
    action: 'unhandled_rejection',
    metadata: { reason: reason, promise: promise }
  });
  shutdown('unhandledRejection');
});

// Iniciar servidor
startServer();