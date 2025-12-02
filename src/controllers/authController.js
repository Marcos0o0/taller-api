const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// Generar tokens JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// @desc    Registrar nuevo usuario
// @route   POST /api/auth/register
// @access  Admin
const register = asyncHandler(async (req, res) => {
  const { username, password, role } = req.body;

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'USER_EXISTS',
        message: 'El nombre de usuario ya está registrado'
      }
    });
  }

  // Crear usuario
  const user = await User.create({
    username,
    password,
    role: role || 'mechanic'
  });

  // Log de registro
  await SystemLog.createLog({
    level: 'info',
    action: 'user_registered',
    userId: req.userId,
    module: 'auth',
    metadata: {
      newUserId: user._id,
      newUsername: user.username,
      newUserRole: user.role
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Usuario registrado exitosamente', {
    module: 'auth',
    action: 'register_success',
    userId: req.userId,
    metadata: { newUserId: user._id, username: user.username }
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    },
    message: 'Usuario registrado exitosamente'
  });
});

// @desc    Iniciar sesión
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Buscar usuario
  const user = await User.findOne({ username, isDeleted: false });

  if (!user) {
    await SystemLog.createLog({
      level: 'warn',
      action: 'login_failed_user_not_found',
      module: 'auth',
      metadata: { username },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas'
      }
    });
  }

  // Verificar si está bloqueado
  if (user.isLocked()) {
    const lockTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
    
    await SystemLog.createLog({
      level: 'warn',
      action: 'login_attempt_account_locked',
      userId: user._id,
      module: 'auth',
      metadata: { username, lockTimeRemaining: lockTime },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    return res.status(423).json({
      success: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message: `Cuenta bloqueada temporalmente. Intenta nuevamente en ${lockTime} minutos.`
      }
    });
  }

  // Verificar contraseña
  const isValidPassword = await user.verifyPassword(password);

  if (!isValidPassword) {
    // Incrementar intentos fallidos
    await user.incLoginAttempts();

    await SystemLog.createLog({
      level: 'warn',
      action: 'login_failed_invalid_password',
      userId: user._id,
      module: 'auth',
      metadata: { 
        username,
        loginAttempts: user.loginAttempts + 1
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas'
      }
    });
  }

  // Resetear intentos fallidos
  await user.resetLoginAttempts();

  // Generar tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Guardar refresh token
  user.refreshToken = refreshToken;
  user.tokenExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  // Log exitoso
  await SystemLog.createLog({
    level: 'info',
    action: 'login_success',
    userId: user._id,
    module: 'auth',
    metadata: { username },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Login exitoso', {
    module: 'auth',
    action: 'login_success',
    userId: user._id,
    metadata: { username }
  });

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        username: user.username,
        role: user.role
      }
    },
    message: 'Inicio de sesión exitoso'
  });
});

// @desc    Renovar access token
// @route   POST /api/auth/refresh
// @access  Public
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token no proporcionado'
      }
    });
  }

  try {
    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Buscar usuario
    const user = await User.findById(decoded.userId);

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido'
        }
      });
    }

    // Verificar que el refresh token coincida
    if (user.refreshToken !== refreshToken) {
      await SystemLog.createLog({
        level: 'warn',
        action: 'refresh_token_mismatch',
        userId: user._id,
        module: 'auth',
        metadata: { username: user.username },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.id
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token inválido'
        }
      });
    }

    // Generar nuevos tokens (rotation)
    const tokens = generateTokens(user._id);

    // Actualizar refresh token
    user.refreshToken = tokens.refreshToken;
    user.tokenExpiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    logger.info('Token renovado exitosamente', {
      module: 'auth',
      action: 'token_refreshed',
      userId: user._id
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      },
      message: 'Token renovado exitosamente'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_EXPIRED',
          message: 'Refresh token expirado. Por favor, inicia sesión nuevamente.'
        }
      });
    }

    throw error;
  }
});

// @desc    Cerrar sesión
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (user) {
    // Invalidar refresh token
    user.refreshToken = null;
    user.tokenExpiration = null;
    await user.save();

    await SystemLog.createLog({
      level: 'info',
      action: 'logout',
      userId: user._id,
      module: 'auth',
      metadata: { username: user.username },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    logger.info('Logout exitoso', {
      module: 'auth',
      action: 'logout',
      userId: user._id
    });
  }

  res.json({
    success: true,
    message: 'Sesión cerrada correctamente'
  });
});

// @desc    Obtener usuario actual
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  res.json({
    success: true,
    data: {
      user: {
        _id: user._id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }
    }
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe
};