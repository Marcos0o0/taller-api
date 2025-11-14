const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB conectado: ${conn.connection.host}`, {
      module: 'database',
      action: 'connect'
    });

    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      logger.error('Error de conexión MongoDB:', {
        module: 'database',
        action: 'connection_error',
        metadata: { error: err.message }
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB desconectado', {
        module: 'database',
        action: 'disconnected'
      });
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconectado', {
        module: 'database',
        action: 'reconnected'
      });
    });

    return conn;
  } catch (error) {
    logger.error('Error al conectar MongoDB:', {
      module: 'database',
      action: 'connect_error',
      metadata: { error: error.message }
    });
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB desconectado correctamente', {
      module: 'database',
      action: 'disconnect'
    });
  } catch (error) {
    logger.error('Error al desconectar MongoDB:', {
      module: 'database',
      action: 'disconnect_error',
      metadata: { error: error.message }
    });
  }
};

module.exports = {
  connectDB,
  disconnectDB
};