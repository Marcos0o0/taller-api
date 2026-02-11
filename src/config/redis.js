// config/redis.js
const redis = require('redis');

let redisClient = null;

const connectRedis = async () => {
  // ✅ Si no hay REDIS_URL configurada, no intentar conectar
  if (!process.env.REDIS_URL) {
    console.warn('⚠️  Redis no configurado (REDIS_URL no definida) — funcionando sin caché');
    return null;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.error('❌ Máximo de reintentos de Redis alcanzado — deshabilitando caché');
            // ✅ Retornar false detiene los reintentos sin crashear el proceso
            return false;
          }
          return Math.min(retries * 200, 2000);
        },
      },
    });

    redisClient.on('error', (err) => {
      // ✅ Solo loguear, no crashear
      console.error(`Redis error: ${err.message}`);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis conectado');
    });

    redisClient.on('reconnecting', () => {
      console.warn('Redis reconectando...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis listo');
    });

    // ✅ Timeout de 5s para no bloquear el arranque del servidor
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      ),
    ]);

    return redisClient;
  } catch (error) {
    console.error(`⚠️  Redis no disponible: ${error.message} — funcionando sin caché`);
    // ✅ Limpiar cliente roto
    if (redisClient) {
      try { redisClient.destroy(); } catch (_) {}
      redisClient = null;
    }
    // ✅ NO relanzar el error — el servidor arranca igual
    return null;
  }
};

const getRedisClient = () => redisClient;

const disconnectRedis = async () => {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log('✅ Redis desconectado');
    } catch (error) {
      console.error(`Error al desconectar Redis: ${error.message}`);
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  disconnectRedis,
};