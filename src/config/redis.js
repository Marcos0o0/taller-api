const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Máximo de reintentos de conexión Redis alcanzado', {
              module: 'redis',
              action: 'max_retries'
            });
            return new Error('Máximo de reintentos alcanzado');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Error de Redis:', {
        module: 'redis',
        action: 'error',
        metadata: { error: err.message }
      });
    });

    redisClient.on('connect', () => {
      logger.info('Redis conectado', {
        module: 'redis',
        action: 'connect'
      });
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis reconectando...', {
        module: 'redis',
        action: 'reconnecting'
      });
    });

    redisClient.on('ready', () => {
      logger.info('Redis listo', {
        module: 'redis',
        action: 'ready'
      });
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Error al conectar Redis:', {
      module: 'redis',
      action: 'connect_error',
      metadata: { error: error.message }
    });
    // No exit process, la aplicación puede funcionar sin caché
    return null;
  }
};

const getRedisClient = () => {
  return redisClient;
};

const disconnectRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      logger.info('Redis desconectado correctamente', {
        module: 'redis',
        action: 'disconnect'
      });
    } catch (error) {
      logger.error('Error al desconectar Redis:', {
        module: 'redis',
        action: 'disconnect_error',
        metadata: { error: error.message }
      });
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
};