const Quote = require('../models/Quote');
const Client = require('../models/Client');
const WorkOrder = require('../models/WorkOrder');
const SystemLog = require('../models/SystemLog');
const emailService = require('../services/emailService');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar presupuestos
// @route   GET /api/quotes
// @access  Admin
const listQuotes = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    status,
    clientId,
    startDate,
    endDate,
    search,
    sort = '-createdAt'
  } = req.query;

  // Construir clave de caché
  const cacheKey = `cache:quotes:list:${page}:${limit}:${status || 'all'}:${clientId || 'all'}:${search || 'all'}`;
  
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  // Construir query
  const query = { isDeleted: false };
  
  if (status) query.status = status;
  if (clientId) query.clientId = clientId;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    query.$or = [
      { quoteNumber: { $regex: search, $options: 'i' } },
      { 'vehicle.licensePlate': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [quotes, total] = await Promise.all([
    Quote.find(query)
      .populate('clientId', 'firstName lastName1 lastName2 email phone')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Quote.countDocuments(query)
  ]);

  const result = {
    quotes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };

  await cacheService.set(cacheKey, result, 180);

  res.json({ success: true, data: result });
});

// @desc    Obtener presupuesto por ID
// @route   GET /api/quotes/:id
// @access  Admin
const getQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const cacheKey = `cache:quote:${id}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, cached: true });
  }

  const quote = await Quote.findById(id)
    .populate('clientId')
    .populate('workOrderId');

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'QUOTE_NOT_FOUND',
        message: 'Presupuesto no encontrado'
      }
    });
  }

  await cacheService.set(cacheKey, { quote }, 180);

  res.json({ success: true, data: { quote } });
});

// @desc    Crear presupuesto
// @route   POST /api/quotes
// @access  Admin
const createQuote = asyncHandler(async (req, res) => {
  const {
    clientId,
    vehicle,
    description,
    proposedWork,
    estimatedCost,
    notes
  } = req.body;

  // Verificar que el cliente existe
  const client = await Client.findById(clientId);
  if (!client || client.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  // Crear presupuesto
  const quote = await Quote.create({
    clientId,
    vehicle,
    description,
    proposedWork,
    estimatedCost,
    notes
  });

  // Log
  await SystemLog.createLog({
    level: 'info',
    action: 'quote_created',
    userId: req.userId,
    module: 'quotes',
    metadata: {
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      clientId,
      estimatedCost
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Presupuesto creado', {
    module: 'quotes',
    action: 'create_success',
    userId: req.userId,
    metadata: { quoteId: quote._id, quoteNumber: quote.quoteNumber }
  });

  await cacheService.invalidateQuotes();

  res.status(201).json({
    success: true,
    data: { quote },
    message: 'Presupuesto creado exitosamente'
  });
});

// @desc    Actualizar presupuesto
// @route   PUT /api/quotes/:id
// @access  Admin
const updateQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, proposedWork, estimatedCost, notes } = req.body;

  const quote = await Quote.findById(id);

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'QUOTE_NOT_FOUND',
        message: 'Presupuesto no encontrado'
      }
    });
  }

  if (!quote.canEdit()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUOTE_CANNOT_EDIT',
        message: 'Solo se pueden editar presupuestos en estado pendiente'
      }
    });
  }

  if (description) quote.description = description;
  if (proposedWork) quote.proposedWork = proposedWork;
  if (estimatedCost !== undefined) quote.estimatedCost = estimatedCost;
  if (notes !== undefined) quote.notes = notes;

  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_updated',
    userId: req.userId,
    module: 'quotes',
    metadata: { quoteId: quote._id, changes: req.body },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateQuotes();
  await cacheService.delete(`cache:quote:${id}`);

  res.json({
    success: true,
    data: { quote },
    message: 'Presupuesto actualizado exitosamente'
  });
});

// @desc    Enviar presupuesto por email
// @route   POST /api/quotes/:id/send-email
// @access  Admin
const sendQuoteEmail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id);

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'QUOTE_NOT_FOUND',
        message: 'Presupuesto no encontrado'
      }
    });
  }

  if (quote.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'QUOTE_ALREADY_PROCESSED',
        message: 'El presupuesto ya fue procesado'
      }
    });
  }

  const client = await Client.findById(quote.clientId);

  if (!client || !client.email) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CLIENT_NO_EMAIL',
        message: 'El cliente no tiene un email válido'
      }
    });
  }

  // Generar tokens
  const tokens = quote.generateTokens();
  await quote.save();

  console.log(">>> Enviando email...");
  // Enviar email
  const result = await emailService.sendQuoteEmail(quote, client, tokens);
  console.log(">>> Resultado del email:", result);

  if (!result.success) {
    quote.emailAttempts += 1;
    await quote.save();

    return res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: 'Error al enviar el correo electrónico',
        details: result.error
      }
    });
  }

  quote.emailSent = true;
  quote.emailSentAt = new Date();
  quote.emailAttempts += 1;
  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_email_sent',
    userId: req.userId,
    module: 'quotes',
    metadata: {
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      clientEmail: client.email
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: 'Presupuesto enviado por correo exitosamente',
    data: {
      emailSent: true,
      emailSentAt: quote.emailSentAt
    }
  });
});

// @desc    Aprobar presupuesto (público con token)
// @route   GET /api/quotes/:id/approve?token=xxx
// @access  Public
const approveQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>Token de aprobación no proporcionado</p>
      </body></html>
    `);
  }

  const quote = await Quote.findById(id).populate('clientId');

  if (!quote) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Presupuesto no encontrado</h1>
      </body></html>
    `);
  }

  const validation = quote.validateToken(token);

  if (!validation.valid) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ ${validation.error}</h1>
        <p>Por favor, contacta al taller para más información.</p>
      </body></html>
    `);
  }

  // Usar token y aprobar
  await quote.useToken(token, req.ip, req.get('user-agent'));
  quote.status = 'approved';
  await quote.save();

  // Crear orden de trabajo automáticamente
  const order = await WorkOrder.create({
    quoteId: quote._id,
    vehicleSnapshot: quote.vehicle,
    workDescription: `${quote.description}\n\nTrabajo propuesto:\n${quote.proposedWork}`,
    estimatedCost: quote.estimatedCost,
    status: 'pendiente_asignacion'
  });

  // Vincular orden al presupuesto
  quote.workOrderId = order._id;
  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_approved_by_client',
    module: 'quotes',
    metadata: {
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      orderNumber: order.orderNumber,
      clientId: quote.clientId._id
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  await cacheService.invalidateQuotes();
  await cacheService.invalidateOrders();

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Presupuesto Aprobado</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 50px; text-align: center; }
        .container { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #27ae60; }
        .info { background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .order-number { font-size: 24px; font-weight: bold; color: #27ae60; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Presupuesto Aprobado</h1>
        <p>¡Gracias por aprobar el presupuesto <strong>${quote.quoteNumber}</strong>!</p>
        <div class="info">
          <p>Se ha creado automáticamente la orden de trabajo:</p>
          <p class="order-number">${order.orderNumber}</p>
        </div>
        <p>Nuestro equipo comenzará a trabajar en su vehículo pronto.</p>
        <p>Le notificaremos por correo cuando esté listo.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          ${process.env.WORKSHOP_NAME}<br>
          ${process.env.WORKSHOP_PHONE}
        </p>
      </div>
    </body>
    </html>
  `);
});

// @desc    Rechazar presupuesto (público con token)
// @route   GET /api/quotes/:id/reject?token=xxx
// @access  Public
const rejectQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>Token de rechazo no proporcionado</p>
      </body></html>
    `);
  }

  const quote = await Quote.findById(id).populate('clientId');

  if (!quote) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ Presupuesto no encontrado</h1>
      </body></html>
    `);
  }

  const validation = quote.validateToken(token);

  if (!validation.valid) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html><head><title>Error</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>❌ ${validation.error}</h1>
      </body></html>
    `);
  }

  await quote.useToken(token, req.ip, req.get('user-agent'));
  quote.status = 'rejected';
  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_rejected_by_client',
    module: 'quotes',
    metadata: {
      quoteId: quote._id,
      quoteNumber: quote.quoteNumber,
      clientId: quote.clientId._id
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  await cacheService.invalidateQuotes();

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Presupuesto Rechazado</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 50px; text-align: center; }
        .container { background: white; padding: 40px; border-radius: 10px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #e74c3c; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>❌ Presupuesto Rechazado</h1>
        <p>Has rechazado el presupuesto <strong>${quote.quoteNumber}</strong></p>
        <p>Gracias por tu respuesta. Si tienes alguna consulta o deseas modificar el presupuesto, no dudes en contactarnos.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 14px;">
          ${process.env.WORKSHOP_NAME}<br>
          ${process.env.WORKSHOP_PHONE}<br>
          ${process.env.WORKSHOP_EMAIL}
        </p>
      </div>
    </body>
    </html>
  `);
});

// @desc    Aprobar presupuesto manualmente (admin)
// @route   PUT /api/quotes/:id/approve
// @access  Admin
const approveQuoteManual = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id);

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: { code: 'QUOTE_NOT_FOUND', message: 'Presupuesto no encontrado' }
    });
  }

  if (quote.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: { code: 'QUOTE_ALREADY_PROCESSED', message: 'El presupuesto ya fue procesado' }
    });
  }

  quote.status = 'approved';
  await quote.save();

  // Crear orden automáticamente
  const order = await WorkOrder.create({
    quoteId: quote._id,
    vehicleSnapshot: quote.vehicle,
    workDescription: `${quote.description}\n\nTrabajo propuesto:\n${quote.proposedWork}`,
    estimatedCost: quote.estimatedCost,
    status: 'pendiente_asignacion'
  });

  quote.workOrderId = order._id;
  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_approved_by_admin',
    userId: req.userId,
    module: 'quotes',
    metadata: { quoteId: quote._id, orderNumber: order.orderNumber },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateQuotes();
  await cacheService.invalidateOrders();

  res.json({
    success: true,
    message: 'Presupuesto aprobado y orden creada',
    data: { quote, order }
  });
});

// @desc    Rechazar presupuesto manualmente (admin)
// @route   PUT /api/quotes/:id/reject
// @access  Admin
const rejectQuoteManual = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id);

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: { code: 'QUOTE_NOT_FOUND', message: 'Presupuesto no encontrado' }
    });
  }

  if (quote.status !== 'pending') {
    return res.status(400).json({
      success: false,
      error: { code: 'QUOTE_ALREADY_PROCESSED', message: 'El presupuesto ya fue procesado' }
    });
  }

  quote.status = 'rejected';
  await quote.save();

  await SystemLog.createLog({
    level: 'info',
    action: 'quote_rejected_by_admin',
    userId: req.userId,
    module: 'quotes',
    metadata: { quoteId: quote._id },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: 'Presupuesto rechazado',
    data: { quote }
  });
});

module.exports = {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  sendQuoteEmail,
  approveQuote,
  rejectQuote,
  approveQuoteManual,
  rejectQuoteManual
};