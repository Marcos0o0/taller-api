const logger = require('../utils/logger');
const SystemLog = require('../models/SystemLog');

// Middleware para rutas no encontradas
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    }
  });
};

// Middleware global de manejo de errores
const errorHandler = async (err, req, res, next) => {
  // Log del error
  logger.error('Error en la aplicación:', {
    module: 'errorHandler',
    action: 'handle_error',
    userId: req.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id,
    metadata: {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    }
  });

  // Registrar en SystemLog
  try {
    await SystemLog.createLog({
      level: 'error',
      action: 'application_error',
      userId: req.userId || null,
      module: 'system',
      metadata: {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });
  } catch (logError) {
    logger.error('Error guardando log en base de datos:', {
      module: 'errorHandler',
      action: 'log_error',
      metadata: { error: logError.message }
    });
  }

  // Determinar código de estado
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Error interno del servidor';

  // Manejar errores específicos de MongoDB
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Error de validación en los datos';
    
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        details
      }
    });
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = `ID inválido: ${err.value}`;
  }

  if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ERROR';
    const field = Object.keys(err.keyPattern)[0];
    message = `El campo "${field}" ya existe en el sistema`;
  }

  // Respuesta de error
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message
    }
  };

  // Incluir stack trace solo en desarrollo
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware para capturar errores asíncronos
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler
};