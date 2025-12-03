const Quote = require("../models/Quote");
const Mechanic = require("../models/Mechanic");
const SystemLog = require("../models/SystemLog");
const cacheService = require("../services/cacheService");
const logger = require("../utils/logger");
const { asyncHandler } = require("../middlewares/errorHandler");

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
    sort = "-createdAt",
  } = req.query;

  // Construir query base - buscar quotes que tengan workOrder
  const query = {
    isDeleted: false,
    workOrder: { $exists: true, $ne: null },
  };

  // Si es mecánico, solo ve sus órdenes
  if (req.user.role === "mechanic") {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        error: {
          code: "MECHANIC_NOT_FOUND",
          message: "Perfil de mecánico no encontrado",
        },
      });
    }
    query["workOrder.mechanicId"] = mechanic._id;
  } else if (mechanicId) {
    // Admin puede filtrar por mecánico
    query["workOrder.mechanicId"] = mechanicId;
  }

  if (status) query["workOrder.status"] = status;
  if (clientId) query.clientId = clientId;

  if (startDate || endDate) {
    query["workOrder.createdAt"] = {};
    if (startDate) query["workOrder.createdAt"].$gte = new Date(startDate);
    if (endDate) query["workOrder.createdAt"].$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { "workOrder.orderNumber": { $regex: search, $options: "i" } },
      { "vehicle.licensePlate": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [quotes, total] = await Promise.all([
    Quote.find(query)
      .populate("clientId", "firstName lastName1 lastName2 email phone")
      .populate("workOrder.mechanicId")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Quote.countDocuments(query),
  ]);

  // Transformar para devolver solo la info de la orden con contexto del quote
  const orders = quotes.map((quote) => ({
    _id: quote._id,
    quoteNumber: quote.quoteNumber,
    client: quote.clientId,
    vehicle: quote.vehicle,
    order: quote.workOrder,
  }));

  const result = {
    orders,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  };

  res.json({ success: true, data: result });
});

// @desc    Obtener orden por ID
// @route   GET /api/orders/:id
// @access  Admin/Mechanic (mecánico solo la suya)
const getOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id)
    .populate("clientId")
    .populate("workOrder.mechanicId");

  if (!quote || !quote.workOrder) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Orden de trabajo no encontrada",
      },
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === "mechanic") {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (
      !mechanic ||
      quote.workOrder.mechanicId?._id.toString() !== mechanic._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "No tienes permiso para ver esta orden",
        },
      });
    }
  }

  const orderData = {
    _id: quote._id,
    quoteNumber: quote.quoteNumber,
    client: quote.clientId,
    vehicle: quote.vehicle,
    quoteDescription: quote.description,
    proposedWork: quote.proposedWork,
    order: quote.workOrder,
  };

  res.json({ success: true, data: { order: orderData } });
});

// @desc    Actualizar orden de trabajo
// @route   PUT /api/orders/:id
// @access  Admin/Mechanic (mecánico solo la suya)
const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { additionalNotes, additionalWork, finalCost, estimatedDelivery } =
    req.body;

  const quote = await Quote.findById(id);

  if (!quote || !quote.workOrder) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Orden de trabajo no encontrada",
      },
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === "mechanic") {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (
      !mechanic ||
      quote.workOrder.mechanicId?.toString() !== mechanic._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "No tienes permiso para editar esta orden",
        },
      });
    }
  }

  // Actualizar usando el método del modelo
  await quote.updateWorkOrder({
    additionalNotes,
    additionalWork,
    finalCost,
    estimatedDelivery,
  });

  await SystemLog.createLog({
    level: "info",
    action: "order_updated",
    userId: req.userId,
    module: "orders",
    metadata: {
      quoteId: quote._id,
      orderNumber: quote.workOrder.orderNumber,
      changes: req.body,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.id,
  });

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    data: { order: quote.workOrder },
    message: "Orden actualizada exitosamente",
  });
});

// @desc    Cambiar estado de orden
// @route   PUT /api/orders/:id/status
// @access  Admin/Mechanic (mecánico solo la suya)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const quote = await Quote.findById(id)
    .populate("clientId")
    .populate("workOrder.mechanicId");

  if (!quote || !quote.workOrder) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Orden de trabajo no encontrada",
      },
    });
  }

  // Si es mecánico, verificar que sea su orden
  if (req.user.role === "mechanic") {
    const mechanic = await Mechanic.findOne({ userId: req.userId });
    if (
      !mechanic ||
      quote.workOrder.mechanicId?.toString() !== mechanic._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "No tienes permiso para modificar esta orden",
        },
      });
    }
  }

  // Cambiar estado con validación
  try {
    await quote.changeWorkOrderStatus(status, req.userId, notes);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message: error.message,
      },
    });
  }

  await SystemLog.createLog({
    level: "info",
    action: "order_status_changed",
    userId: req.userId,
    module: "orders",
    metadata: {
      quoteId: quote._id,
      orderNumber: quote.workOrder.orderNumber,
      newStatus: status,
      notes,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.id,
  });

  logger.info("Estado de orden cambiado", {
    module: "orders",
    action: "status_changed",
    userId: req.userId,
    metadata: {
      quoteId: quote._id,
      orderNumber: quote.workOrder.orderNumber,
      newStatus: status,
    },
  });

  await cacheService.invalidateQuotes();

  // Verificar si se envió email automáticamente
  const emailSent = status === "listo" && quote.workOrder.readyEmailSent;

  res.json({
    success: true,
    data: { order: quote.workOrder },
    message: `Estado actualizado a "${status}" exitosamente`,
    emailSent,
  });
});

// @desc    Asignar mecánico a orden
// @route   PUT /api/orders/:id/assign
// @access  Admin
const assignMechanic = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { mechanicId } = req.body;

  const quote = await Quote.findById(id);

  if (!quote || !quote.workOrder) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Orden de trabajo no encontrada",
      },
    });
  }

  // Verificar que el mecánico existe y está activo
  const mechanic = await Mechanic.findById(mechanicId);

  if (!mechanic) {
    return res.status(404).json({
      success: false,
      error: {
        code: "MECHANIC_NOT_FOUND",
        message: "Mecánico no encontrado",
      },
    });
  }

  if (!mechanic.isActive) {
    return res.status(400).json({
      success: false,
      error: {
        code: "MECHANIC_INACTIVE",
        message: "El mecánico no está activo",
      },
    });
  }

  // Asignar mecánico usando el método del modelo
  await quote.assignMechanic(mechanicId, req.userId);

  await SystemLog.createLog({
    level: "info",
    action: "mechanic_assigned",
    userId: req.userId,
    module: "orders",
    metadata: {
      quoteId: quote._id,
      orderNumber: quote.workOrder.orderNumber,
      mechanicId,
      mechanicName: mechanic.getFullName(),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.id,
  });

  logger.info("Mecánico asignado a orden", {
    module: "orders",
    action: "mechanic_assigned",
    userId: req.userId,
    metadata: {
      quoteId: quote._id,
      mechanicId,
    },
  });

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    data: { order: quote.workOrder },
    message: "Mecánico asignado exitosamente",
  });
});

// @desc    Eliminar orden (soft delete del quote si la orden está pendiente)
// @route   DELETE /api/orders/:id
// @access  Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id);

  if (!quote || !quote.workOrder) {
    return res.status(404).json({
      success: false,
      error: {
        code: "ORDER_NOT_FOUND",
        message: "Orden de trabajo no encontrada",
      },
    });
  }

  if (quote.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: "ORDER_ALREADY_DELETED",
        message: "La orden ya está eliminada",
      },
    });
  }

  // Verificar si se puede eliminar
  if (!quote.canDeleteWorkOrder()) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CANNOT_DELETE_ORDER",
        message:
          'Solo se pueden eliminar órdenes en estado "pendiente_asignacion"',
      },
    });
  }

  // Soft delete del quote completo (incluye la orden)
  await quote.softDelete(req.userId);

  await SystemLog.createLog({
    level: "info",
    action: "order_deleted",
    userId: req.userId,
    module: "orders",
    metadata: {
      quoteId: quote._id,
      orderNumber: quote.workOrder.orderNumber,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    requestId: req.id,
  });

  logger.info("Orden eliminada", {
    module: "orders",
    action: "delete_success",
    userId: req.userId,
    metadata: { quoteId: quote._id },
  });

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: "Orden eliminada exitosamente",
  });
});

module.exports = {
  listOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  assignMechanic,
  deleteOrder,
};
