const { getRedisClient } = require('../config/redis');

class CacheService {
  constructor() {
    this.defaultTTL = parseInt(process.env.CACHE_TTL_DEFAULT) || 300; // 5 minutos
  }

  getClient() {
    const client = getRedisClient();
    if (!client || !client.isOpen) {
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
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error(`Error obteniendo caché: ${key} - ${error.message}`);
      return null;
    }
  }

  async set(key, data, ttl = null) {
    const client = this.getClient();
    if (!client) return false;

    try {
      const expirationTime = ttl || this.defaultTTL;
      await client.setEx(key, expirationTime, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Error guardando caché: ${key} - ${error.message}`);
      return false;
    }
  }

  async delete(key) {
    const client = this.getClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error(`Error eliminando caché: ${key} - ${error.message}`);
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
        console.log(`Cache invalidado: ${pattern} (${keys.length} claves)`);
      }
      return true;
    } catch (error) {
      console.error(`Error invalidando caché: ${pattern} - ${error.message}`);
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
      console.error(`Error en getOrFetch: ${key} - ${error.message}`);
      
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
      console.log('Cache completamente limpiado');
      return true;
    } catch (error) {
      console.error(`Error limpiando todo el caché - ${error.message}`);
      return false;
    }
  }
}

module.exports = new CacheService();