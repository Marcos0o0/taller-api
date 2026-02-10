const Quote = require("../models/Quote");
const Vehicle = require("../models/Vehicle");
const Client = require("../models/Client");
const Mechanic = require("../models/Mechanic");
const emailService = require("../services/emailService");
const cacheService = require("../services/cacheService");
const { asyncHandler } = require("../middlewares/errorHandler");

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
    sort = "-createdAt",
  } = req.query;

  // Construir clave de caché
  const cacheKey = `cache:quotes:list:${page}:${limit}:${status || "all"}:${
    clientId || "all"
  }:${search || "all"}`;

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
      { quoteNumber: { $regex: search, $options: "i" } },
      { "vehicle.licensePlate": { $regex: search, $options: "i" } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [quotes, total] = await Promise.all([
    Quote.find(query)
      .populate("clientId", "firstName lastName1 lastName2 email phone")
      .populate("vehicleId") // ✅ NUEVO: Popular vehículo si existe referencia
      .populate("workOrder.mechanicId")
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Quote.countDocuments(query),
  ]);

  const result = {
    quotes,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
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
    .populate("clientId")
    .populate("vehicleId") // ✅ NUEVO: Popular vehículo
    .populate("workOrder.mechanicId");

  if (!quote || quote.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  // ✅ NUEVO: Obtener información completa del vehículo
  const vehicleInfo = quote.getVehicleInfo ? await quote.getVehicleInfo() : null;

  const responseData = { quote };
  if (vehicleInfo) {
    responseData.vehicleInfo = vehicleInfo;
  }

  await cacheService.set(cacheKey, responseData, 180);

  res.json({ success: true, data: responseData });
});

// @desc    Crear presupuesto
// @route   POST /api/quotes
// @access  Admin
const createQuote = asyncHandler(async (req, res) => {
  const {
    clientId,
    vehicle,
    vehicleId, // ✅ NUEVO: ID de vehículo existente
    description,
    proposedWork,
    estimatedCost,
    notes,
    includeIVA,
    abonos, // ✅ NUEVO: Array de abonos
    totalAbonos, // ✅ NUEVO: Total de abonos
    saldoPendiente, // ✅ NUEVO: Saldo pendiente
  } = req.body;

  // Verificar que el cliente existe y no está eliminado
  const client = await Client.findOne({
    _id: clientId,
    isDeleted: false,
  });

  if (!client) {
    return res.status(404).json({
      success: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "Cliente no encontrado o eliminado",
      },
    });
  }

  // ✅ NUEVO: Determinar cómo manejar el vehículo
  let finalVehicleId = null;
  let vehicleData = null;
  let normalizedPlate = null;

  if (vehicleId) {
    // Opción 1: Usar vehículo existente
    const existingVehicle = await Vehicle.findOne({
      _id: vehicleId,
      isActive: true,
    });

    if (!existingVehicle) {
      return res.status(404).json({
        success: false,
        error: {
          code: "VEHICLE_NOT_FOUND",
          message: "Vehículo no encontrado o inactivo",
        },
      });
    }

    // Verificar que el vehículo pertenece al cliente
    if (existingVehicle.cliente.toString() !== clientId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VEHICLE_CLIENT_MISMATCH",
          message: "El vehículo no pertenece al cliente seleccionado",
        },
      });
    }

    finalVehicleId = vehicleId;
    normalizedPlate = existingVehicle.patente;

    // Actualizar kilometraje si es mayor
    if (vehicle && vehicle.mileage > existingVehicle.kilometraje) {
      await Vehicle.findByIdAndUpdate(vehicleId, {
        $max: { kilometraje: vehicle.mileage },
      });
    }

    // Guardar datos del vehículo como objeto también (para histórico)
    vehicleData = {
      brand: existingVehicle.marca,
      model: existingVehicle.modelo,
      year: existingVehicle.año,
      licensePlate: existingVehicle.patente,
      mileage: vehicle?.mileage || existingVehicle.kilometraje,
    };
  } else if (vehicle) {
    // Opción 2: Crear nuevo vehículo o usar datos embebidos
    normalizedPlate = vehicle.licensePlate.toUpperCase().replace(/[\s-]/g, "");

    // Validar año del vehículo
    const currentYear = new Date().getFullYear();
    if (vehicle.year < 1950 || vehicle.year > currentYear + 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_VEHICLE_YEAR",
          message: `El año del vehículo debe estar entre 1950 y ${currentYear + 1}`,
        },
      });
    }

    // ✅ NUEVO: Verificar si el vehículo ya existe para este cliente
    const existingVehicle = await Vehicle.findOne({
      cliente: clientId,
      patente: normalizedPlate,
      isActive: true,
    });

    if (existingVehicle) {
      // Si existe, usar ese vehículo
      finalVehicleId = existingVehicle._id;

      // Actualizar kilometraje si es mayor
      if (vehicle.mileage > existingVehicle.kilometraje) {
        await Vehicle.findByIdAndUpdate(existingVehicle._id, {
          $max: { kilometraje: vehicle.mileage },
        });
      }

      vehicleData = {
        brand: existingVehicle.marca,
        model: existingVehicle.modelo,
        year: existingVehicle.año,
        licensePlate: existingVehicle.patente,
        mileage: vehicle.mileage || existingVehicle.kilometraje,
      };
    } else {
      // Si no existe, crear nuevo vehículo
      const newVehicle = await Vehicle.create({
        cliente: clientId,
        patente: normalizedPlate,
        marca: vehicle.brand.trim(),
        modelo: vehicle.model.trim(),
        año: vehicle.year,
        kilometraje: vehicle.mileage || 0,
      });

      finalVehicleId = newVehicle._id;
      vehicleData = {
        brand: vehicle.brand.trim(),
        model: vehicle.model.trim(),
        year: vehicle.year,
        licensePlate: normalizedPlate,
        mileage: vehicle.mileage || 0,
      };
    }
  } else {
    return res.status(400).json({
      success: false,
      error: {
        code: "VEHICLE_REQUIRED",
        message: "Debe proporcionar datos del vehículo o un ID de vehículo existente",
      },
    });
  }

  // Verificar si ya existe un presupuesto pendiente para este vehículo
  const existingQuote = await Quote.checkDuplicatePending(clientId, normalizedPlate);

  if (existingQuote) {
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_PENDING_QUOTE",
        message: `Ya existe un presupuesto pendiente (${existingQuote.quoteNumber}) para este vehículo`,
        existingQuote: {
          quoteNumber: existingQuote.quoteNumber,
          validUntil: existingQuote.validUntil,
        },
      },
    });
  }

  // Validar costo estimado
  if (estimatedCost < 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_COST",
        message: "El costo estimado debe ser mayor o igual a 0",
      },
    });
  }

  // ✅ NUEVO: Validar abonos si existen
  if (abonos && abonos.length > 0) {
    const calculatedTotal = abonos.reduce((sum, a) => sum + a.amount, 0);

    // Validar que el total calculado coincide
    if (Math.abs(calculatedTotal - (totalAbonos || 0)) > 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ABONOS_TOTAL_MISMATCH",
          message: "El total de abonos no coincide con la suma de los montos",
        },
      });
    }

    // Validar que no exceda el costo estimado
    if (calculatedTotal > estimatedCost) {
      return res.status(400).json({
        success: false,
        error: {
          code: "ABONOS_EXCEED_COST",
          message: "Los abonos no pueden exceder el costo estimado",
        },
      });
    }

    // Validar saldo pendiente
    const calculatedSaldo = estimatedCost - calculatedTotal;
    if (Math.abs(calculatedSaldo - (saldoPendiente || 0)) > 0.01) {
      return res.status(400).json({
        success: false,
        error: {
          code: "SALDO_MISMATCH",
          message: "El saldo pendiente no coincide con el cálculo",
        },
      });
    }
  }

  // Crear presupuesto con datos normalizados
  const quoteData = {
    clientId,
    vehicleId: finalVehicleId, // ✅ NUEVO: Referencia al vehículo
    vehicle: vehicleData, // Mantener datos embebidos para histórico
    description: description.trim(),
    proposedWork: proposedWork.trim(),
    estimatedCost,
    notes: notes?.trim(),
    includeIVA: includeIVA !== undefined ? includeIVA : true,
  };

  // ✅ NUEVO: Agregar abonos si existen
  if (abonos && abonos.length > 0) {
    quoteData.abonos = abonos.map((abono) => ({
      amount: abono.amount,
      date: abono.date || new Date(),
      notes: abono.notes || "",
      registeredBy: req.userId, // Usuario que registra el abono
    }));
  }

  const quote = await Quote.create(quoteData);

  console.log(
    `Presupuesto creado: ${quote.quoteNumber} - Cliente: ${clientId} - Costo: ${estimatedCost}${
      finalVehicleId ? ` - Vehículo ID: ${finalVehicleId}` : ""
    }`
  );

  // Popular datos relacionados
  await quote.populate("clientId", "firstName lastName1 lastName2 email phone");
  if (finalVehicleId) {
    await quote.populate("vehicleId");
  }

  // Generar tokens de aprobación
  const tokens = quote.generateTokens();
  await quote.save();

  await cacheService.invalidateQuotes();

  res.status(201).json({
    success: true,
    data: {
      quote,
      tokens, // ✅ NUEVO: Retornar tokens para envío de email
    },
    message: "Presupuesto creado exitosamente",
  });
});

// @desc    Actualizar presupuesto
// @route   PUT /api/quotes/:id
// @access  Admin
const updateQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, proposedWork, estimatedCost, notes, includeIVA, vehicle } = req.body;

  const quote = await Quote.findById(id);

  if (!quote || quote.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  if (!quote.canEdit()) {
    return res.status(400).json({
      success: false,
      error: {
        code: "QUOTE_CANNOT_EDIT",
        message: "Solo se pueden editar presupuestos en estado pendiente sin orden de trabajo",
      },
    });
  }

  if (description) quote.description = description.trim();
  if (proposedWork) quote.proposedWork = proposedWork.trim();
  if (estimatedCost !== undefined) quote.estimatedCost = estimatedCost;
  if (notes !== undefined) quote.notes = notes.trim();
  if (includeIVA !== undefined) quote.includeIVA = includeIVA;

  // ✅ NUEVO: Permitir actualizar datos del vehículo si está embebido
  if (vehicle && !quote.vehicleId) {
    Object.assign(quote.vehicle, vehicle);
  }

  await quote.save();

  console.log(`Presupuesto actualizado: ${quote.quoteNumber} por usuario ID: ${req.userId}`);

  await cacheService.invalidateQuotes();
  await cacheService.delete(`cache:quote:${id}`);

  res.json({
    success: true,
    data: { quote },
    message: "Presupuesto actualizado exitosamente",
  });
});

// ✅ NUEVO: Agregar abono a un presupuesto existente
// @desc    Agregar abono a presupuesto
// @route   POST /api/quotes/:id/abonos
// @access  Admin
const addAbono = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, notes } = req.body;

  const quote = await Quote.findById(id);

  if (!quote || quote.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  // Solo permitir agregar abonos a presupuestos pendientes o aprobados
  if (quote.status !== "pending" && quote.status !== "approved") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATUS",
        message: "Solo se pueden agregar abonos a presupuestos pendientes o aprobados",
      },
    });
  }

  // Validar que el método addAbono existe en el modelo
  if (typeof quote.addAbono !== "function") {
    return res.status(500).json({
      success: false,
      error: {
        code: "METHOD_NOT_FOUND",
        message: "El método addAbono no está disponible en el modelo",
      },
    });
  }

  try {
    // Agregar el abono usando el método del modelo
    await quote.addAbono(amount, notes, req.userId);

    console.log(`Abono agregado al presupuesto: ${quote.quoteNumber} - Monto: ${amount}`);

    await cacheService.invalidateQuotes();
    await cacheService.delete(`cache:quote:${id}`);

    res.status(200).json({
      success: true,
      data: {
        quote,
        message: "Abono agregado exitosamente",
      },
    });
  } catch (error) {
    console.error("Error adding abono:", error);
    return res.status(400).json({
      success: false,
      error: {
        code: "ABONO_ERROR",
        message: error.message,
      },
    });
  }
});

// ✅ NUEVO: Eliminar abono de un presupuesto
// @desc    Eliminar abono de presupuesto
// @route   DELETE /api/quotes/:id/abonos/:abonoIndex
// @access  Admin
const removeAbono = asyncHandler(async (req, res) => {
  const { id, abonoIndex } = req.params;

  const quote = await Quote.findById(id);

  if (!quote || quote.isDeleted) {
    return res.status(404).json({
      success: false,
      error: {
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  // Validar que el método removeAbono existe en el modelo
  if (typeof quote.removeAbono !== "function") {
    return res.status(500).json({
      success: false,
      error: {
        code: "METHOD_NOT_FOUND",
        message: "El método removeAbono no está disponible en el modelo",
      },
    });
  }

  try {
    // Usar el método del modelo
    await quote.removeAbono(parseInt(abonoIndex));

    console.log(`Abono eliminado del presupuesto: ${quote.quoteNumber} - Índice: ${abonoIndex}`);

    await cacheService.invalidateQuotes();
    await cacheService.delete(`cache:quote:${id}`);

    res.status(200).json({
      success: true,
      data: {
        quote,
        message: "Abono eliminado exitosamente",
      },
    });
  } catch (error) {
    console.error("Error removing abono:", error);
    return res.status(400).json({
      success: false,
      error: {
        code: "ABONO_ERROR",
        message: error.message,
      },
    });
  }
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
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  if (quote.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: {
        code: "QUOTE_ALREADY_PROCESSED",
        message: "El presupuesto ya fue procesado",
      },
    });
  }

  const client = await Client.findById(quote.clientId);

  if (!client || !client.email) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CLIENT_NO_EMAIL",
        message: "El cliente no tiene un email válido",
      },
    });
  }

  // Generar tokens
  const tokens = quote.generateTokens();
  await quote.save();

  // Enviar email
  const result = await emailService.sendQuoteEmail(quote, client, tokens);

  if (!result.success) {
    quote.emailAttempts += 1;
    await quote.save();

    return res.status(500).json({
      success: false,
      error: {
        code: "EMAIL_SEND_FAILED",
        message: "Error al enviar el correo electrónico",
        details: result.error,
      },
    });
  }

  quote.emailSent = true;
  quote.emailSentAt = new Date();
  quote.emailAttempts += 1;
  await quote.save();

  console.log(`Email enviado para presupuesto: ${quote.quoteNumber} a ${client.email}`);

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: "Presupuesto enviado por correo exitosamente",
    data: {
      emailSent: true,
      emailSentAt: quote.emailSentAt,
    },
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

  const quote = await Quote.findById(id).populate("clientId");

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
  await quote.useToken(token, req.ip, req.get("user-agent"));
  quote.status = "approved";
  await quote.save();

  // Crear orden de trabajo automáticamente (como subdocumento)
  await quote.createWorkOrder();

  console.log(
    `Presupuesto aprobado por cliente: ${quote.quoteNumber} - Orden: ${quote.workOrder.orderNumber}`
  );

  await cacheService.invalidateQuotes();

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
          <p class="order-number">${quote.workOrder.orderNumber}</p>
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

  const quote = await Quote.findById(id).populate("clientId");

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

  await quote.useToken(token, req.ip, req.get("user-agent"));
  quote.status = "rejected";
  await quote.save();

  console.log(`Presupuesto rechazado por cliente: ${quote.quoteNumber}`);

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
      error: { code: "QUOTE_NOT_FOUND", message: "Presupuesto no encontrado" },
    });
  }

  if (quote.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: {
        code: "QUOTE_ALREADY_PROCESSED",
        message: "El presupuesto ya fue procesado",
      },
    });
  }

  quote.status = "approved";
  await quote.save();

  // Crear orden automáticamente
  await quote.createWorkOrder();

  console.log(
    `Presupuesto aprobado manualmente por admin: ${quote.quoteNumber} - Orden: ${quote.workOrder.orderNumber}`
  );

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: "Presupuesto aprobado y orden creada",
    data: { quote },
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
      error: { code: "QUOTE_NOT_FOUND", message: "Presupuesto no encontrado" },
    });
  }

  if (quote.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: {
        code: "QUOTE_ALREADY_PROCESSED",
        message: "El presupuesto ya fue procesado",
      },
    });
  }

  quote.status = "rejected";
  await quote.save();

  console.log(`Presupuesto rechazado manualmente por admin: ${quote.quoteNumber}`);

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: "Presupuesto rechazado",
    data: { quote },
  });
});

// @desc    Eliminar presupuesto (soft delete)
// @route   DELETE /api/quotes/:id
// @access  Admin
const deleteQuote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const quote = await Quote.findById(id);

  if (!quote) {
    return res.status(404).json({
      success: false,
      error: {
        code: "QUOTE_NOT_FOUND",
        message: "Presupuesto no encontrado",
      },
    });
  }

  if (quote.isDeleted) {
    return res.status(400).json({
      success: false,
      error: {
        code: "QUOTE_ALREADY_DELETED",
        message: "El presupuesto ya está eliminado",
      },
    });
  }

  // Verificar si se puede eliminar
  if (!quote.canDelete()) {
    return res.status(400).json({
      success: false,
      error: {
        code: "CANNOT_DELETE_QUOTE",
        message: "Solo se pueden eliminar presupuestos pendientes sin orden de trabajo",
      },
    });
  }

  // Soft delete
  await quote.softDelete(req.userId);

  console.log(`Presupuesto eliminado: ${quote.quoteNumber} por usuario ID: ${req.userId}`);

  await cacheService.invalidateQuotes();

  res.json({
    success: true,
    message: "Presupuesto eliminado exitosamente",
  });
});

module.exports = {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  addAbono,
  removeAbono,
  sendQuoteEmail,
  approveQuote,
  rejectQuote,
  approveQuoteManual,
  rejectQuoteManual,
  deleteQuote,
};