const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const requestId = require('./middlewares/requestId');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const logger = require('./utils/logger');

const app = express();

// Middlewares de seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Request ID único
app.use(requestId);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      module: 'http',
      action: 'request',
      requestId: req.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  const { getRedisClient } = require('./config/redis');
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis: 'unknown'
    }
  };

  const redisClient = getRedisClient();
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'error';
    }
  } else {
    health.services.redis = 'disconnected';
  }

  const statusCode = health.services.mongodb === 'connected' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/quotes', require('./routes/quoteRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/mechanics', require('./routes/mechanicRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API del Sistema de Gestión de Taller Mecánico',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      clients: '/api/clients',
      quotes: '/api/quotes',
      orders: '/api/orders',
      mechanics: '/api/mechanics',
      logs: '/api/logs'
    }
  });
});

// Manejo de rutas no encontradas
app.use(notFound);

// Manejo global de errores
app.use(errorHandler);

module.exports = app;