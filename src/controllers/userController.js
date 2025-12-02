const User = require('../models/User');
const Mechanic = require('../models/Mechanic');
const SystemLog = require('../models/SystemLog');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar usuarios
// @route   GET /api/users
// @access  Admin
const listUsers = asyncHandler(async (req, res) => {
  const { role, includeDeleted = false } = req.query;

  const query = {};
  
  if (role) query.role = role;
  if (includeDeleted !== 'true') query.isDeleted = false;

  const users = await User.find(query)
    .select('-password -refreshToken')
    .sort('-createdAt')
    .lean();

  res.json({
    success: true,
    data: { users }
  });
});

// @desc    Obtener usuario por ID
// @route   GET /api/users/:id
// @access  Admin
const getUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password -refreshToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  // Si es mecánico, obtener su perfil
  let mechanicProfile = null;
  if (user.role === 'mechanic') {
    mechanicProfile = await Mechanic.findOne({ userId: user._id });
  }

  res.json({
    success: true,
    data: {
      user,
      mechanicProfile
    }
  });
});

// @desc    Crear usuario (ya existe en authController como register)
// @route   POST /api/users
// @access  Admin
const createUser = asyncHandler(async (req, res) => {
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

  await SystemLog.createLog({
    level: 'info',
    action: 'user_created',
    userId: req.userId,
    module: 'users',
    metadata: {
      newUserId: user._id,
      newUsername: user.username,
      newUserRole: user.role
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  res.status(201).json({
    success: true,
    data: { user },
    message: 'Usuario creado exitosamente'
  });
});

// @desc    Actualizar usuario
// @route   PUT /api/users/:id
// @access  Admin
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, role } = req.body;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  if (user.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_DELETED',
        message: 'No se puede actualizar un usuario eliminado'
      }
    });
  }

  // Verificar que no cambie el username a uno existente
  if (username && username !== user.username) {
    const existingUser = await User.findOne({ username, _id: { $ne: id } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USERNAME_EXISTS',
          message: 'El nombre de usuario ya está en uso'
        }
      });
    }
    user.username = username;
  }

  if (role) user.role = role;

  await user.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'user_updated',
    userId: req.userId,
    module: 'users',
    metadata: {
      targetUserId: user._id,
      changes: req.body
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  res.json({
    success: true,
    data: { user },
    message: 'Usuario actualizado exitosamente'
  });
});

// @desc    Cambiar contraseña
// @route   PUT /api/users/:id/password
// @access  Admin
const changePassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  if (user.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_DELETED',
        message: 'No se puede cambiar contraseña de usuario eliminado'
      }
    });
  }

  user.password = newPassword;
  user.refreshToken = null;
  user.tokenExpiration = null;
  await user.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'password_changed',
    userId: req.userId,
    module: 'users',
    metadata: {
      targetUserId: user._id,
      targetUsername: user.username
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  res.json({
    success: true,
    message: 'Contraseña cambiada exitosamente'
  });
});

// @desc    Desactivar/Activar usuario
// @route   PUT /api/users/:id/toggle-status
// @access  Admin
const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  // No se puede modificar el estado de usuarios eliminados
  if (user.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_DELETED',
        message: 'No se puede modificar usuario eliminado'
      }
    });
  }

  // Toggle: si está activo (no tiene lockUntil), bloquearlo permanentemente
  // Si está bloqueado, desbloquearlo
  if (user.lockUntil && user.lockUntil > Date.now()) {
    // Desbloquear
    user.lockUntil = null;
    user.loginAttempts = 0;
    await user.save();

    await SystemLog.createLog({
      level: 'info',
      action: 'user_activated',
      userId: req.userId,
      module: 'users',
      metadata: { targetUserId: user._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    return res.json({
      success: true,
      message: 'Usuario activado exitosamente',
      data: { user }
    });
  } else {
    // Bloquear permanentemente
    user.lockUntil = new Date('2099-12-31');
    await user.save();

    await SystemLog.createLog({
      level: 'warn',
      action: 'user_deactivated',
      userId: req.userId,
      module: 'users',
      metadata: { targetUserId: user._id },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.id
    });

    return res.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
      data: { user }
    });
  }
});

// @desc    Eliminar usuario (soft delete)
// @route   DELETE /api/users/:id
// @access  Admin
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  // No se puede eliminar a sí mismo
  if (user._id.toString() === req.userId.toString()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_DELETE_SELF',
        message: 'No puedes eliminar tu propio usuario'
      }
    });
  }

  if (user.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_ALREADY_DELETED',
        message: 'El usuario ya está eliminado'
      }
    });
  }

  // Si es mecánico, verificar que no tenga órdenes activas
  if (user.role === 'mechanic') {
    const mechanic = await Mechanic.findOne({ userId: user._id });
    if (mechanic) {
      const canDeleteResult = await mechanic.canDelete();
      if (!canDeleteResult.canDelete) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CANNOT_DELETE_USER',
            message: canDeleteResult.reason
          }
        });
      }
      
      // Soft delete del mecánico también
      await mechanic.softDelete(req.userId);
    }
  }

  // Soft delete del usuario
  await user.softDelete(req.userId);

  await SystemLog.createLog({
    level: 'warn',
    action: 'user_deleted',
    userId: req.userId,
    module: 'users',
    metadata: {
      targetUserId: user._id,
      targetUsername: user.username,
      targetRole: user.role
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  res.json({
    success: true,
    message: 'Usuario eliminado exitosamente'
  });
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  toggleUserStatus,
  deleteUser
};