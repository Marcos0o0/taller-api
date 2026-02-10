const Vehicle = require('../models/Vehicle');
const Client = require('../models/Client');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar vehículos
// @route   GET /api/vehicles
// @access  Admin/Mechanic
const listVehicles = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    clienteId,
    marca,
    isActive,
    sort = '-createdAt'
  } = req.query;

  // Construir query
  const query = { isDeleted: false };

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (clienteId) {
    query.cliente = clienteId;
  }

  if (marca) {
    query.marca = { $regex: marca, $options: 'i' };
  }

  if (search) {
    query.$or = [
      { patente: { $regex: search, $options: 'i' } },
      { marca: { $regex: search, $options: 'i' } },
      { modelo: { $regex: search, $options: 'i' } },
      { vin: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [vehicles, total] = await Promise.all([
    Vehicle.find(query)
      .populate('cliente', 'rut name email phone')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Vehicle.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      vehicles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

// @desc    Obtener vehículo por ID
// @route   GET /api/vehicles/:id
// @access  Admin/Mechanic
const getVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id)
    .populate('cliente', 'rut name email phone address')
    .populate('historialKilometraje.registradoPor', 'username');

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  res.json({
    success: true,
    data: { vehicle }
  });
});

// @desc    Buscar vehículo por patente
// @route   GET /api/vehicles/patente/:patente
// @access  Admin/Mechanic
const getVehicleByPatente = asyncHandler(async (req, res) => {
  const { patente } = req.params;

  const vehicle = await Vehicle.findOne({
    patente: patente.toUpperCase(),
    isDeleted: false
  }).populate('cliente', 'rut name email phone');

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  res.json({
    success: true,
    data: { vehicle }
  });
});

// @desc    Obtener vehículos de un cliente
// @route   GET /api/vehicles/cliente/:clienteId
// @access  Admin/Mechanic
const getVehiclesByCliente = asyncHandler(async (req, res) => {
  const { clienteId } = req.params;

  // Verificar que el cliente existe
  const client = await Client.findById(clienteId);
  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  const vehicles = await Vehicle.find({
    cliente: clienteId,
    isDeleted: false
  }).sort('-createdAt');

  res.json({
    success: true,
    data: { vehicles }
  });
});

// @desc    Crear vehículo
// @route   POST /api/vehicles
// @access  Admin/Mechanic
const createVehicle = asyncHandler(async (req, res) => {
  const {
    patente,
    marca,
    modelo,
    año,
    color,
    vin,
    motor,
    combustible,
    transmision,
    cliente,
    kilometraje,
    observaciones
  } = req.body;

  // Verificar que el cliente existe
  const clientExists = await Client.findById(cliente);
  if (!clientExists) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CLIENT_NOT_FOUND',
        message: 'Cliente no encontrado'
      }
    });
  }

  // Verificar si la patente ya existe
  const existingVehicle = await Vehicle.findOne({
    patente: patente.toUpperCase(),
    isDeleted: false
  });

  if (existingVehicle) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'PATENTE_EXISTS',
        message: 'Ya existe un vehículo con esa patente'
      }
    });
  }

  // Crear vehículo
  const vehicle = await Vehicle.create({
    patente: patente.toUpperCase().trim(),
    marca: marca.trim(),
    modelo: modelo.trim(),
    año,
    color: color?.trim(),
    vin: vin?.toUpperCase().trim(),
    motor: motor?.trim(),
    combustible,
    transmision,
    cliente,
    kilometraje: kilometraje || 0,
    observaciones: observaciones?.trim()
  });

  // Si tiene kilometraje inicial, agregarlo al historial
  if (kilometraje > 0) {
    vehicle.historialKilometraje.push({
      kilometraje,
      fecha: new Date(),
      observaciones: 'Kilometraje inicial',
      registradoPor: req.userId
    });
    vehicle.ultimoKilometraje = 0;
    vehicle.fechaUltimoKilometraje = new Date();
    await vehicle.save();
  }

  // Poblar información del cliente
  await vehicle.populate('cliente', 'rut name email phone');

  res.status(201).json({
    success: true,
    data: { vehicle },
    message: 'Vehículo creado exitosamente'
  });
});

// @desc    Actualizar vehículo
// @route   PUT /api/vehicles/:id
// @access  Admin/Mechanic
const updateVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    marca,
    modelo,
    año,
    color,
    vin,
    motor,
    combustible,
    transmision,
    observaciones,
    isActive
  } = req.body;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  if (vehicle.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VEHICLE_DELETED',
        message: 'No se puede actualizar un vehículo eliminado'
      }
    });
  }

  // Actualizar campos (la patente no se puede cambiar)
  if (marca) vehicle.marca = marca.trim();
  if (modelo) vehicle.modelo = modelo.trim();
  if (año) vehicle.año = año;
  if (color !== undefined) vehicle.color = color?.trim();
  if (vin !== undefined) vehicle.vin = vin?.toUpperCase().trim();
  if (motor !== undefined) vehicle.motor = motor?.trim();
  if (combustible) vehicle.combustible = combustible;
  if (transmision) vehicle.transmision = transmision;
  if (observaciones !== undefined) vehicle.observaciones = observaciones?.trim();
  if (isActive !== undefined) vehicle.isActive = isActive;

  await vehicle.save();
  await vehicle.populate('cliente', 'rut name email phone');

  res.json({
    success: true,
    data: { vehicle },
    message: 'Vehículo actualizado exitosamente'
  });
});


/**
 * Listar vehículos con filtro por cliente
 */
exports.getVehicles = async (req, res) => {
  try {
    const { 
      cliente, // ✅ NUEVO: Filtro por cliente
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    // Construir filtro
    const filter = { isActive: true };
    
    // ✅ NUEVO: Filtrar por cliente
    if (cliente) {
      filter.cliente = cliente;
    }

    // Búsqueda por patente o marca/modelo
    if (search) {
      filter.$or = [
        { patente: { $regex: search, $options: 'i' } },
        { marca: { $regex: search, $options: 'i' } },
        { modelo: { $regex: search, $options: 'i' } }
      ];
    }

    const vehicles = await Vehicle.find(filter)
      .populate('cliente', 'firstName lastName1 lastName2 phone')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await Vehicle.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        vehicles,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });

  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Error al obtener vehículos' },
    });
  }
};

// @desc    Actualizar kilometraje
// @route   PUT /api/vehicles/:id/kilometraje
// @access  Admin/Mechanic
const updateKilometraje = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { kilometraje, observaciones } = req.body;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  if (vehicle.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VEHICLE_DELETED',
        message: 'No se puede actualizar un vehículo eliminado'
      }
    });
  }

  // Validar que el nuevo kilometraje sea mayor al actual
  if (kilometraje < vehicle.kilometraje) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_KILOMETRAJE',
        message: 'El nuevo kilometraje debe ser mayor al actual'
      }
    });
  }

  await vehicle.actualizarKilometraje(kilometraje, observaciones, req.userId);

  res.json({
    success: true,
    data: { vehicle },
    message: 'Kilometraje actualizado exitosamente'
  });
});

// @desc    Eliminar vehículo (soft delete)
// @route   DELETE /api/vehicles/:id
// @access  Admin
const deleteVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  if (vehicle.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VEHICLE_ALREADY_DELETED',
        message: 'El vehículo ya está eliminado'
      }
    });
  }

  await vehicle.softDelete(req.userId);

  res.json({
    success: true,
    message: 'Vehículo eliminado exitosamente'
  });
});

// @desc    Restaurar vehículo
// @route   PUT /api/vehicles/:id/restore
// @access  Admin
const restoreVehicle = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id);

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  if (!vehicle.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_DELETED',
        message: 'El vehículo no está eliminado'
      }
    });
  }

  await vehicle.restore();
  await vehicle.populate('cliente', 'rut name email phone');

  res.json({
    success: true,
    data: { vehicle },
    message: 'Vehículo restaurado exitosamente'
  });
});

// @desc    Obtener historial de kilometraje
// @route   GET /api/vehicles/:id/historial-kilometraje
// @access  Admin/Mechanic
const getKilometrajeHistorial = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vehicle = await Vehicle.findById(id)
    .populate('historialKilometraje.registradoPor', 'username');

  if (!vehicle) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehículo no encontrado'
      }
    });
  }

  const historial = vehicle.historialKilometraje.sort((a, b) => b.fecha - a.fecha);

  res.json({
    success: true,
    data: { historial }
  });
});

module.exports = {
  listVehicles,
  getVehicle,
  getVehicleByPatente,
  getVehiclesByCliente,
  createVehicle,
  updateVehicle,
  updateKilometraje,
  deleteVehicle,
  restoreVehicle,
  getKilometrajeHistorial
};