const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Middleware para verificar token JWT
const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Token de autenticación no proporcionado'
        }
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario
    const user = await User.findById(decoded.userId);

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido o usuario no existe'
        }
      });
    }

    // Verificar si está bloqueado
    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos'
        }
      });
    }

    // Agregar usuario a la request
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token inválido'
        }
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expirado. Por favor, renueva tu sesión'
        }
      });
    }

    logger.error('Error en autenticación:', {
      module: 'auth',
      action: 'authenticate_error',
      metadata: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Error en el proceso de autenticación'
      }
    });
  }
};

// Middleware para verificar roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Usuario no autenticado'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Acceso denegado por rol insuficiente', {
        module: 'auth',
        action: 'access_denied',
        userId: req.user._id,
        metadata: {
          userRole: req.user.role,
          requiredRoles: roles
        }
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permisos para realizar esta acción'
        }
      });
    }

    next();
  };
};

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && !user.isDeleted && !user.isLocked()) {
        req.user = user;
        req.userId = user._id;
      }
    }
  } catch (error) {
    // Ignorar errores en autenticación opcional
  }
  
  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};