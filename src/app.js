const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const requestId = require('./middlewares/requestId');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// ✅ Crear servidor HTTP
const server = http.createServer(app);

// ✅ Configurar Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
app.set('io', io);

// ✅ Middleware de autenticación para WebSocket
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('No token provided'));
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.userId = decoded.id;
    socket.userRole = decoded.role;

    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
});

// ✅ Configurar alertService con io (una sola vez, fuera del bloque connection)
const alertService = require('./services/alertService');
alertService.setIO(io);
alertService.iniciarMonitoreo(30); // verificar alertas cada 30 minutos

// ✅ Manejo de conexiones WebSocket
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id} (User: ${socket.userId})`);

  // Unir a sala de alertas
  socket.join('alerts');

  // Enviar estadísticas iniciales al cliente que se conecta
  alertService.obtenerEstadisticas()
    .then((stats) => {
      socket.emit('alertas-actualizadas', stats);
    })
    .catch((err) => {
      console.error('Error obteniendo estadísticas iniciales:', err);
    });

  // Escuchar solicitud de alertas
  socket.on('solicitar-alertas', async (filters) => {
    try {
      const Alert = require('./models/Alert');
      const alerts = await Alert.find(filters || { estado: 'activa' })
        .populate('repuesto')
        .limit(10)
        .sort('-fechaCreacion');

      socket.emit('alertas-enviadas', alerts);
    } catch (error) {
      console.error('Error enviando alertas:', error);
      socket.emit('error', { message: 'Error al obtener alertas' });
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Middlewares de seguridad
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Request ID único
app.use(requestId);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests en desarrollo
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Request ID: ${req.id}`);
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
      redis: 'unknown',
      websocket: io.engine.clientsCount >= 0 ? 'active' : 'inactive',
    },
    connections: {
      websocket: io.engine.clientsCount || 0,
    },
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

app.use('/api', require('./routes/appVersionRoutes'));

// API Routes (con autenticación)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/quotes', require('./routes/quoteRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/mechanics', require('./routes/mechanicRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/vehicles', require('./routes/vehicleRoutes'));
app.use('/api/alerts', require('./routes/alertsRoutes'));
app.use('/api/vehicle-images', require('./routes/vehicleImagesRoutes'));

// Ruta raíz
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API del Sistema de Gestión de Taller Mecánico',
    version: '1.0.0',
    websocket: {
      connected: io.engine.clientsCount || 0,
      status: 'active',
    },
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      clients: '/api/clients',
      quotes: '/api/quotes',
      orders: '/api/orders',
      mechanics: '/api/mechanics',
      inventory: '/api/inventory',
      alerts: '/api/alerts',
      appVersion: '/api/app-version.json',
      vehicleImages: '/api/vehicle-images',
    },
  });
});

// Manejo de rutas no encontradas
app.use(notFound);

// Manejo global de errores
app.use(errorHandler);

// ✅ Exportar app, server e io
module.exports = { app, server, io };