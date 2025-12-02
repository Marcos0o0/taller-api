const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Rate limiter para endpoints públicos (aprobar/rechazar presupuestos)
const publicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW) || 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_PUBLIC_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes desde esta IP. Por favor, intenta más tarde.'
    }
  },
  handler: (req, res) => {
    logger.warn('Rate limit excedido - Endpoint público', {
      module: 'security',
      action: 'rate_limit_exceeded',
      ipAddress: req.ip,
      metadata: {
        endpoint: req.path
      }
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiadas solicitudes. Por favor, intenta más tarde.'
      }
    });
  }
});

// Rate limiter para autenticación (login)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit excedido - Login', {
      module: 'security',
      action: 'login_rate_limit_exceeded',
      ipAddress: req.ip,
      metadata: {
        username: req.body?.username
      }
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en 15 minutos.'
      }
    });
  }
});

// Rate limiter para administradores
const adminLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW) || 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_ADMIN_MAX) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.user && req.user.role === 'admin';
  }
});

// Rate limiter para mecánicos
const mechanicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_MECHANIC_WINDOW) || 60 * 60 * 1000, // 1 hora
  max: parseInt(process.env.RATE_LIMIT_MECHANIC_MAX) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.user && req.user.role === 'mechanic';
  }
});

// Rate limiter general basado en rol
const roleLimiter = (req, res, next) => {
  if (!req.user) {
    return publicLimiter(req, res, next);
  }

  if (req.user.role === 'admin') {
    return adminLimiter(req, res, next);
  }

  if (req.user.role === 'mechanic') {
    return mechanicLimiter(req, res, next);
  }

  return publicLimiter(req, res, next);
};

module.exports = {
  publicLimiter,
  authLimiter,
  adminLimiter,
  mechanicLimiter,
  roleLimiter
};