const WorkOrder = require('../models/WorkOrder');
const Quote = require('../models/Quote');
const Mechanic = require('../models/Mechanic');
const SystemLog = require('../models/SystemLog');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar órdenes de trabajo
// @route   GET /api/orders
// @access  Admin/Mechanic (mecánico solo ve las suyas)
const listOrders = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status,
    mechanicId,
    clientId,
    startDate,
    endDate,
    search,
    sort = '-createdAt'
  } = req.query;

  // Construir query base
  const query = { isDeleted: false };
  
  // Si es mecánico, solo ve sus órdenes
  if (req.user.role === 'mechanic') {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'MECHANIC_NOT_FOUND',
          message: 'Perfil de mecánico no encontrado'
        }
      });
    }
    query.mechanicId = mechanic._id;
  } else if (mechanicId) {
    // Admin puede filtrar por mecánico
    query.mechanicId = mechanicId;
  }

  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'vehicleSnapshot.licensePlate': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await Promise.all([
    WorkOrder.find(query)
      .populate({
        path: 'quoteId',
        populate: { path: 'clientId', select: 'firstName lastName1 lastName2 email phone' }
      })
      .populate('mechanicId')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    WorkOrder.countDocuments(query)
  ]);

  const result = {
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };

  res.json({ success: true, data: result });
});

// @desc    Obtener orden por ID
// @route   GET /api/orders/:id
// @access  Admin/Mechanic (mecánico solo la suya)
const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await WorkOrder.findById(id)
    .populate({
      path: 'quoteId',
      populate: { path: 'clientId' }
    })
    .populate('mechanicId');

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Orden de trabajo no encontrada'
      }
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === 'mechanic') {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (!mechanic || order.mechanicId?._id.toString() !== mechanic._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para ver esta orden'
        }
      });
    }
  }

  res.json({ success: true, data: { order } });
});

// @desc    Actualizar orden de trabajo
// @route   PUT /api/orders/:id
// @access  Admin/Mechanic (mecánico solo la suya)
const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { additionalNotes, additionalWork, finalCost, estimatedDelivery } = req.body;

  const order = await WorkOrder.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Orden de trabajo no encontrada'
      }
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === 'mechanic') {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (!mechanic || order.mechanicId?.toString() !== mechanic._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para editar esta orden'
        }
      });
    }
  }

  // Actualizar campos
  if (additionalNotes !== undefined) order.additionalNotes = additionalNotes;
  if (additionalWork !== undefined) order.additionalWork = additionalWork;
  if (finalCost !== undefined) order.finalCost = finalCost;
  if (estimatedDelivery !== undefined) order.estimatedDelivery = estimatedDelivery;

  await order.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'order_updated',
    userId: req.userId,
    module: 'orders',
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      changes: req.body
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateOrders();

  res.json({
    success: true,
    data: { order },
    message: 'Orden actualizada exitosamente'
  });
});

// @desc    Cambiar estado de orden
// @route   PUT /api/orders/:id/status
// @access  Admin/Mechanic (mecánico solo la suya)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const order = await WorkOrder.findById(id)
    .populate({
      path: 'quoteId',
      populate: { path: 'clientId' }
    });

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Orden de trabajo no encontrada'
      }
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === 'mechanic') {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (!mechanic || order.mechanicId?.toString() !== mechanic._id.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'No tienes permiso para modificar esta orden'
        }
      });
    }
  }

  // Cambiar estado con validación
  try {
    await order.changeStatus(status, req.userId, notes);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: error.message
      }
    });
  }

  await SystemLog.createLog({
    level: 'info',
    action: 'order_status_changed',
    userId: req.userId,
    module: 'orders',
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      newStatus: status,
      notes
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Estado de orden cambiado', {
    module: 'orders',
    action: 'status_changed',
    userId: req.userId,
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      newStatus: status
    }
  });

  await cacheService.invalidateOrders();

  // Verificar si se envió email automáticamente
  const emailSent = status === 'listo' && order.readyEmailSent;

  res.json({
    success: true,
    data: { order },
    message: `Estado actualizado a "${status}" exitosamente`,
    emailSent
  });
});

// @desc    Asignar mecánico a orden
// @route   PUT /api/orders/:id/assign
// @access  Admin
const assignMechanic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mechanicId } = req.body;

  const order = await WorkOrder.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Orden de trabajo no encontrada'
      }
    });
  }

  // Verificar que el mecánico existe y está activo
  const mechanic = await Mechanic.findById(mechanicId);

  if (!mechanic) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'MECHANIC_NOT_FOUND',
        message: 'Mecánico no encontrado'
      }
    });
  }

  if (!mechanic.isActive) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MECHANIC_INACTIVE',
        message: 'El mecánico no está activo'
      }
    });
  }

  const previousMechanicId = order.mechanicId;
  order.mechanicId = mechanicId;

  // Si está en pendiente_asignacion, cambiar a asignada
  if (order.status === 'pendiente_asignacion') {
    await order.changeStatus('asignada', req.userId, 'Mecánico asignado');
  } else {
    await order.save();
  }

  await SystemLog.createLog({
    level: 'info',
    action: 'mechanic_assigned',
    userId: req.userId,
    module: 'orders',
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      previousMechanicId,
      newMechanicId: mechanicId,
      mechanicName: mechanic.getFullName()
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Mecánico asignado a orden', {
    module: 'orders',
    action: 'mechanic_assigned',
    userId: req.userId,
    metadata: {
      orderId: order._id,
      mechanicId
    }
  });

  await cacheService.invalidateOrders();
  await cacheService.invalidateMechanics();

  res.json({
    success: true,
    data: { order },
    message: 'Mecánico asignado exitosamente'
  });
});

// @desc    Eliminar orden (soft delete)
// @route   DELETE /api/orders/:id
// @access  Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await WorkOrder.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Orden de trabajo no encontrada'
      }
    });
  }

  if (order.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ORDER_ALREADY_DELETED',
        message: 'La orden ya está eliminada'
      }
    });
  }

  // Verificar si se puede eliminar
  if (!order.canDelete()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_DELETE_ORDER',
        message: 'Solo se pueden eliminar órdenes en estado "pendiente_asignacion"'
      }
    });
  }

  // Soft delete
  await order.softDelete(req.userId);

  await SystemLog.createLog({
    level: 'info',
    action: 'order_deleted',
    userId: req.userId,
    module: 'orders',
    metadata: {
      orderId: order._id,
      orderNumber: order.orderNumber
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Orden eliminada', {
    module: 'orders',
    action: 'delete_success',
    userId: req.userId,
    metadata: { orderId: order._id }
  });

  await cacheService.invalidateOrders();

  res.json({
    success: true,
    message: 'Orden eliminada exitosamente'
  });
});

module.exports = {
  listOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  assignMechanic,
  deleteOrder
};