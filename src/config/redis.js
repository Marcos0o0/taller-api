const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('Máximo de reintentos de conexión Redis alcanzado');
            return new Error('Máximo de reintentos alcanzado');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.error(`Error de Redis: ${err.message}`);
    });

    redisClient.on('connect', () => {
      console.log('Redis conectado');
    });

    redisClient.on('reconnecting', () => {
      console.warn('Redis reconectando...');
    });

    redisClient.on('ready', () => {
      console.log('Redis listo');
    });

    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    console.error(`Error al conectar Redis: ${error.message}`);
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
      console.log('Redis desconectado correctamente');
    } catch (error) {
      console.error(`Error al desconectar Redis: ${error.message}`);
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis
};