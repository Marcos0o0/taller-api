require('dotenv').config();
const { app, server, io } = require('./app');
const { connectDB, disconnectDB } = require('./config/database');
const { connectRedis, disconnectRedis } = require('./config/redis');
const emailService = require('./services/emailService');
const alertService = require('./services/alertService');

const PORT = process.env.PORT || 3000;

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    console.log('✅ MongoDB conectado');

    // Conectar a Redis (no crítico si falla)
    try {
      await connectRedis();
      console.log('✅ Redis conectado');
    } catch (error) {
      console.warn('⚠️ Redis no disponible. El sistema funcionará sin caché:', error.message);
    }

    // Inicializar servicio de email
    try {
      await emailService.initialize();
      console.log('✅ Servicio de email inicializado');
    } catch (error) {
      console.warn('⚠️ Servicio de email no disponible:', error.message);
    }

    // ✅ Iniciar servidor (ahora usando server en lugar de app)
    server.listen(PORT, () => {
      console.log(`🚀 Servidor HTTP corriendo en puerto ${PORT}`);
      console.log(`📡 WebSocket disponible en ws://localhost:${PORT}`);
      
      console.log(`
╔════════════════════════════════════════════════════════╗
║   SISTEMA DE GESTIÓN DE TALLER MECÁNICO               ║
║   Puerto: ${PORT}                                         ║
║   Entorno: ${process.env.NODE_ENV || 'development'}                               ║
║   Health: http://localhost:${PORT}/health                 ║
║   API: http://localhost:${PORT}/api                       ║
║   WebSocket: ws://localhost:${PORT}                       ║
╚════════════════════════════════════════════════════════╝
      `);

      // ✅ Iniciar sistema de alertas
      console.log('🔔 Inicializando sistema de alertas...');
      
      // Verificar alertas cada 30 minutos
      alertService.iniciarMonitoreo(30);
      console.log('✅ Monitoreo de alertas iniciado (cada 30 minutos)');
      
      // Auto-resolver alertas cada hora
      setInterval(() => {
        console.log('🔄 Ejecutando auto-resolución de alertas...');
        alertService.autoResolverAlertasStockNormalizado();
      }, 60 * 60 * 1000);
      console.log('✅ Auto-resolución de alertas configurada (cada hora)');
      
      // Limpiar alertas antiguas cada día a las 2 AM
      const now = new Date();
      const twoAM = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        2,
        0,
        0
      );
      const msUntilTwoAM = twoAM.getTime() - now.getTime();
      
      setTimeout(() => {
        console.log('🗑️ Ejecutando limpieza de alertas antiguas...');
        alertService.limpiarAlertasAntiguas(30);
        
        // Luego ejecutar cada 24 horas
        setInterval(() => {
          console.log('🗑️ Limpieza diaria de alertas antiguas...');
          alertService.limpiarAlertasAntiguas(30);
        }, 24 * 60 * 60 * 1000);
      }, msUntilTwoAM);
      
      console.log(`✅ Limpieza automática programada para las 2:00 AM (en ${Math.round(msUntilTwoAM / 1000 / 60)} minutos)`);
      console.log('✅ Sistema de alertas completamente inicializado');
    });

  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n⚠️ Señal ${signal} recibida. Iniciando cierre graceful...`);

  // ✅ Detener monitoreo de alertas
  try {
    alertService.detenerMonitoreo();
    console.log('✅ Monitoreo de alertas detenido');
  } catch (error) {
    console.error('❌ Error deteniendo alertas:', error.message);
  }

  if (server) {
    // ✅ Cerrar WebSocket primero
    if (io) {
      io.close(() => {
        console.log('✅ WebSocket cerrado');
      });
    }

    server.close(async () => {
      console.log('✅ Servidor HTTP cerrado');

      // Cerrar conexiones
      try {
        await disconnectDB();
        console.log('✅ MongoDB desconectado');
      } catch (error) {
        console.error('❌ Error desconectando MongoDB:', error.message);
      }

      try {
        await disconnectRedis();
        console.log('✅ Redis desconectado');
      } catch (error) {
        console.error('❌ Error desconectando Redis:', error.message);
      }

      console.log('✅ Todas las conexiones cerradas. Saliendo...');
      process.exit(0);
    });

    // Forzar cierre después de 10 segundos
    setTimeout(() => {
      console.error('⏰ Tiempo de espera agotado. Forzando salida...');
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
  console.error('❌ Excepción no capturada:', error.message);
  console.error(error.stack);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada no manejada:', reason);
  console.error('Promise:', promise);
  shutdown('unhandledRejection');
});

// ✅ Manejo de errores de WebSocket
if (io) {
  io.on('error', (error) => {
    console.error('❌ Error en WebSocket:', error);
  });
}

// Iniciar servidor
startServer();