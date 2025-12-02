const Mechanic = require('../models/Mechanic');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar mecánicos
// @route   GET /api/mechanics
// @access  Admin
const listMechanics = asyncHandler(async (req, res) => {
  const { isActive, includeDeleted = false } = req.query;

  const query = {};
  
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (includeDeleted !== 'true') {
    query.isDeleted = false;
  }

  const mechanics = await Mechanic.find(query)
    .populate('userId', 'username role')
    .sort('-createdAt')
    .lean();

  // Obtener estadísticas de cada mecánico
  const mechanicsWithStats = await Promise.all(
    mechanics.map(async (mech) => {
      const mechanicDoc = await Mechanic.findById(mech._id);
      const stats = await mechanicDoc.getStats();
      return { ...mech, stats };
    })
  );

  res.json({
    success: true,
    data: { mechanics: mechanicsWithStats }
  });
});

// @desc    Obtener mecánico por ID
// @route   GET /api/mechanics/:id
// @access  Admin
const getMechanic = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const mechanic = await Mechanic.findById(id)
    .populate('userId', 'username role');

  if (!mechanic) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MECHANIC_NOT_FOUND',
        message: 'Mecánico no encontrado'
      }
    });
  }

  const stats = await mechanic.getStats();

  res.json({
    success: true,
    data: {
      mechanic,
      stats
    }
  });
});

// @desc    Crear mecánico
// @route   POST /api/mechanics
// @access  Admin
const createMechanic = asyncHandler(async (req, res) => {
  const { userId, firstName, lastName1, lastName2, phone } = req.body;

  // Verificar que el usuario existe y es mecánico
  const user = await User.findById(userId);

  if (!user || user.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Usuario no encontrado'
      }
    });
  }

  if (user.role !== 'mechanic') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'USER_NOT_MECHANIC',
        message: 'El usuario debe tener rol de mecánico'
      }
    });
  }

  // Verificar que no exista otro mecánico con ese userId
  const existingMechanic = await Mechanic.findOne({ userId, isDeleted: false });

  if (existingMechanic) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'MECHANIC_EXISTS',
        message: 'Ya existe un perfil de mecánico para este usuario'
      }
    });
  }

  // Crear mecánico
  const mechanic = await Mechanic.create({
    userId,
    firstName,
    lastName1,
    lastName2,
    phone
  });

  await SystemLog.createLog({
    level: 'info',
    action: 'mechanic_created',
    userId: req.userId,
    module: 'mechanics',
    metadata: {
      mechanicId: mechanic._id,
      mechanicName: mechanic.getFullName(),
      linkedUserId: userId
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Mecánico creado', {
    module: 'mechanics',
    action: 'create_success',
    userId: req.userId,
    metadata: { mechanicId: mechanic._id }
  });

  await cacheService.invalidateMechanics();

  res.status(201).json({
    success: true,
    data: { mechanic },
    message: 'Mecánico creado exitosamente'
  });
});

// @desc    Actualizar mecánico
// @route   PUT /api/mechanics/:id
// @access  Admin
const updateMechanic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName1, lastName2, phone, isActive } = req.body;

  const mechanic = await Mechanic.findById(id);

  if (!mechanic) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MECHANIC_NOT_FOUND',
        message: 'Mecánico no encontrado'
      }
    });
  }

  if (mechanic.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MECHANIC_DELETED',
        message: 'No se puede actualizar un mecánico eliminado'
      }
    });
  }

  // Actualizar campos
  if (firstName) mechanic.firstName = firstName;
  if (lastName1) mechanic.lastName1 = lastName1;
  if (lastName2 !== undefined) mechanic.lastName2 = lastName2;
  if (phone) mechanic.phone = phone;
  if (isActive !== undefined) mechanic.isActive = isActive;

  await mechanic.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'mechanic_updated',
    userId: req.userId,
    module: 'mechanics',
    metadata: {
      mechanicId: mechanic._id,
      changes: req.body
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateMechanics();

  res.json({
    success: true,
    data: { mechanic },
    message: 'Mecánico actualizado exitosamente'
  });
});

// @desc    Obtener órdenes del mecánico
// @route   GET /api/mechanics/:id/orders
// @access  Admin
const getMechanicOrders = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, page = 1, limit = 20 } = req.query;

  const mechanic = await Mechanic.findById(id);

  if (!mechanic) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MECHANIC_NOT_FOUND',
        message: 'Mecánico no encontrado'
      }
    });
  }

  const WorkOrder = require('../models/WorkOrder');

  const query = {
    mechanicId: id,
    isDeleted: false
  };

  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await Promise.all([
    WorkOrder.find(query)
      .populate({
        path: 'quoteId',
        populate: { path: 'clientId', select: 'firstName lastName1 lastName2 email phone' }
      })
      .sort('-createdAt')
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    WorkOrder.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      mechanic,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

module.exports = {
  listMechanics,
  getMechanic,
  createMechanic,
  updateMechanic,
  getMechanicOrders
};