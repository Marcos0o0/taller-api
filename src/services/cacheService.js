const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.defaultTTL = parseInt(process.env.CACHE_TTL_DEFAULT) || 300; // 5 minutos
  }

  getClient() {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      logger.warn('Redis no disponible, operación de caché omitida', {
        module: 'cache',
        action: 'client_unavailable'
      });
      return null;
    }
    return client;
  }

  async get(key) {
    const client = this.getClient();
    if (!client) return null;

    try {
      const data = await client.get(key);
      if (data) {
        logger.debug(`Cache hit: ${key}`, {
          module: 'cache',
          action: 'get_hit'
        });
        return JSON.parse(data);
      }
      
      logger.debug(`Cache miss: ${key}`, {
        module: 'cache',
        action: 'get_miss'
      });
      return null;
    } catch (error) {
      logger.error(`Error obteniendo caché: ${key}`, {
        module: 'cache',
        action: 'get_error',
        metadata: { error: error.message }
      });
      return null;
    }
  }

  async set(key, data, ttl = null) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const expirationTime = ttl || this.defaultTTL;
      await client.setEx(key, expirationTime, JSON.stringify(data));
      
      logger.debug(`Cache set: ${key} (TTL: ${expirationTime}s)`, {
        module: 'cache',
        action: 'set'
      });
      return true;
    } catch (error) {
      logger.error(`Error guardando caché: ${key}`, {
        module: 'cache',
        action: 'set_error',
        metadata: { error: error.message }
      });
      return false;
    }
  }

  async delete(key) {
    const client = this.getClient();
    if (!client) return false;

    try {
      await client.del(key);
      logger.debug(`Cache deleted: ${key}`, {
        module: 'cache',
        action: 'delete'
      });
      return true;
    } catch (error) {
      logger.error(`Error eliminando caché: ${key}`, {
        module: 'cache',
        action: 'delete_error',
        metadata: { error: error.message }
      });
      return false;
    }
  }

  async invalidate(pattern) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
        logger.info(`Cache invalidated: ${pattern} (${keys.length} keys)`, {
          module: 'cache',
          action: 'invalidate',
          metadata: { keysCount: keys.length }
        });
      }
      return true;
    } catch (error) {
      logger.error(`Error invalidando caché: ${pattern}`, {
        module: 'cache',
        action: 'invalidate_error',
        metadata: { error: error.message }
      });
      return false;
    }
  }

  async getOrFetch(key, fetchFn, ttl = null) {
    try {
      // Intentar obtener del caché
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Si no está en caché, obtener de la fuente
      const data = await fetchFn();
      
      // Guardar en caché
      if (data !== null && data !== undefined) {
        await this.set(key, data, ttl);
      }
      
      return data;
    } catch (error) {
      logger.error(`Error en getOrFetch: ${key}`, {
        module: 'cache',
        action: 'getOrFetch_error',
        metadata: { error: error.message }
      });
      
      // Si hay error, intentar obtener directamente sin caché
      return await fetchFn();
    }
  }

  // Métodos específicos por módulo
  async invalidateClients() {
    await this.invalidate('cache:clients:*');
    await this.invalidate('cache:client:*');
  }

  async invalidateQuotes() {
    await this.invalidate('cache:quotes:*');
    await this.invalidate('cache:quote:*');
  }

  async invalidateOrders() {
    await this.invalidate('cache:orders:*');
    await this.invalidate('cache:order:*');
  }

  async invalidateMechanics() {
    await this.invalidate('cache:mechanics:*');
    await this.invalidate('cache:mechanic:*');
  }

  async flushAll() {
    const client = this.getClient();
    if (!client) return false;

    try {
      await client.flushAll();
      logger.info('Cache completamente limpiado', {
        module: 'cache',
        action: 'flush_all'
      });
      return true;
    } catch (error) {
      logger.error('Error limpiando todo el caché', {
        module: 'cache',
        action: 'flush_all_error',
        metadata: { error: error.message }
      });
      return false;
    }
  }
}

module.exports = new CacheService();