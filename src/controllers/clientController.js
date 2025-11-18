const Client = require('../models/Client');
const Quote = require('../models/Quote');
const WorkOrder = require('../models/WorkOrder');
const SystemLog = require('../models/SystemLog');
const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar clientes
// @route   GET /api/clients
// @access  Admin
const listClients = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    search, 
    sort = '-createdAt',
    includeDeleted = false 
  } = req.query;

  // Construir clave de caché
  const cacheKey = `cache:clients:list:${page}:${limit}:${search || 'all'}:${sort}:${includeDeleted}`;
  
  // Intentar obtener desde caché
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    logger.debug('Clientes obtenidos desde caché', {
      module: 'clients',
      action: 'list_from_cache',
      userId: req.userId
    });
    return res.json({
      success: true,
      data: cached,
      cached: true
    });
  }

  // Construir query
  const query = {};
  
  // Solo admin puede ver eliminados
  if (req.user.role === 'admin' && includeDeleted === 'true') {
    // Mostrar todos
  } else {
    query.isDeleted = false;
  }

  // Búsqueda por nombre, apellido o email
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName1: { $regex: search, $options: 'i' } },
      { lastName2: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Ejecutar queries en paralelo
  const [clients, total] = await Promise.all([
    Client.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Client.countDocuments(query)
  ]);

  const result = {
    clients,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };

  // Guardar en caché por 10 minutos
  await cacheService.set(cacheKey, result, 600);

  logger.info('Clientes listados exitosamente', {
    module: 'clients',
    action: 'list_success',
    userId: req.userId,
    metadata: { count: clients.length, total }
  });

  res.json({
    success: true,
    data: result
  });
});

// @desc    Obtener cliente por ID
// @route   GET /api/clients/:id
// @access  Admin
const getClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Intentar desde caché
  const cacheKey = `cache:client:${id}`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true
    });
  }

  // Buscar cliente
  const client = await Client.findById(id);

  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  // Obtener estadísticas
  const stats = await client.getStats();

  const result = {
    client,
    stats
  };

  // Guardar en caché
  await cacheService.set(cacheKey, result, 600);

  res.json({
    success: true,
    data: result
  });
});

// @desc    Crear cliente
// @route   POST /api/clients
// @access  Admin
const createClient = asyncHandler(async (req, res) => {
  const { firstName, lastName1, lastName2, phone, email } = req.body;

  // Verificar si el email ya existe
  const existingClient = await Client.findOne({ email, isDeleted: false });
  
  if (existingClient) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Ya existe un cliente con ese correo electrónico'
      }
    });
  }

  // Crear cliente
  const client = await Client.create({
    firstName,
    lastName1,
    lastName2,
    phone,
    email
  });

  // Log
  await SystemLog.createLog({
    level: 'info',
    action: 'client_created',
    userId: req.userId,
    module: 'clients',
    metadata: {
      clientId: client._id,
      clientEmail: client.email
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Cliente creado exitosamente', {
    module: 'clients',
    action: 'create_success',
    userId: req.userId,
    metadata: { clientId: client._id }
  });

  // Invalidar caché
  await cacheService.invalidateClients();

  res.status(201).json({
    success: true,
    data: { client },
    message: 'Cliente creado exitosamente'
  });
});

// @desc    Actualizar cliente
// @route   PUT /api/clients/:id
// @access  Admin
const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName1, lastName2, phone, email } = req.body;

  // Buscar cliente
  const client = await Client.findById(id);

  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  if (client.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CLIENT_DELETED',
        message: 'No se puede actualizar un cliente eliminado'
      }
    });
  }

  // Si cambió el email, verificar que no exista
  if (email && email !== client.email) {
    const emailExists = await Client.findOne({ 
      email, 
      _id: { $ne: id },
      isDeleted: false 
    });
    
    if (emailExists) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Ya existe otro cliente con ese correo electrónico'
        }
      });
    }
  }

  // Actualizar campos
  if (firstName) client.firstName = firstName;
  if (lastName1) client.lastName1 = lastName1;
  if (lastName2 !== undefined) client.lastName2 = lastName2;
  if (phone) client.phone = phone;
  if (email) client.email = email;

  await client.save();

  // Log
  await SystemLog.createLog({
    level: 'info',
    action: 'client_updated',
    userId: req.userId,
    module: 'clients',
    metadata: {
      clientId: client._id,
      changes: req.body
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Cliente actualizado exitosamente', {
    module: 'clients',
    action: 'update_success',
    userId: req.userId,
    metadata: { clientId: client._id }
  });

  // Invalidar caché
  await cacheService.invalidateClients();
  await cacheService.delete(`cache:client:${id}`);

  res.json({
    success: true,
    data: { client },
    message: 'Cliente actualizado exitosamente'
  });
});

// @desc    Eliminar cliente (soft delete)
// @route   DELETE /api/clients/:id
// @access  Admin
const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar cliente
  const client = await Client.findById(id);

  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  if (client.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CLIENT_ALREADY_DELETED',
        message: 'El cliente ya está eliminado'
      }
    });
  }

  // Verificar si se puede eliminar
  const canDeleteResult = await client.canDelete();
  
  if (!canDeleteResult.canDelete) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'CANNOT_DELETE_CLIENT',
        message: canDeleteResult.reason
      }
    });
  }

  // Soft delete
  await client.softDelete(req.userId);

  // Log
  await SystemLog.createLog({
    level: 'info',
    action: 'client_deleted',
    userId: req.userId,
    module: 'clients',
    metadata: {
      clientId: client._id,
      clientEmail: client.email
    },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });

  logger.info('Cliente eliminado exitosamente', {
    module: 'clients',
    action: 'delete_success',
    userId: req.userId,
    metadata: { clientId: client._id }
  });

  // Invalidar caché
  await cacheService.invalidateClients();
  await cacheService.delete(`cache:client:${id}`);

  res.json({
    success: true,
    message: 'Cliente eliminado exitosamente'
  });
});

// @desc    Obtener historial del cliente
// @route   GET /api/clients/:id/history
// @access  Admin
const getClientHistory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type = 'all', status, startDate, endDate } = req.query;

  // Buscar cliente
  const client = await Client.findById(id);

  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  let quotes = [];
  let orders = [];

  // Construir filtros
  const quoteQuery = { clientId: id, isDeleted: false };
  if (status) quoteQuery.status = status;
  if (startDate || endDate) {
    quoteQuery.createdAt = {};
    if (startDate) quoteQuery.createdAt.$gte = new Date(startDate);
    if (endDate) quoteQuery.createdAt.$lte = new Date(endDate);
  }

  // Obtener presupuestos si es necesario
  if (type === 'all' || type === 'quotes') {
    quotes = await Quote.find(quoteQuery)
      .sort('-createdAt')
      .lean();
  }

  // Obtener órdenes si es necesario
  if (type === 'all' || type === 'orders') {
    const quoteIds = quotes.length > 0 
      ? quotes.map(q => q._id) 
      : (await Quote.find({ clientId: id }).select('_id')).map(q => q._id);
    
    const orderQuery = { 
      quoteId: { $in: quoteIds },
      isDeleted: false 
    };
    
    if (status) orderQuery.status = status;
    if (startDate || endDate) {
      orderQuery.createdAt = {};
      if (startDate) orderQuery.createdAt.$gte = new Date(startDate);
      if (endDate) orderQuery.createdAt.$lte = new Date(endDate);
    }

    orders = await WorkOrder.find(orderQuery)
      .sort('-createdAt')
      .lean();
  }

  // Obtener estadísticas
  const stats = await client.getStats();

  res.json({
    success: true,
    data: {
      client,
      quotes,
      orders,
      summary: stats
    }
  });
});

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory
};