const clientSearch = require('../utils/clientSearch');
const Quote = require('../models/Quote');
const Vehicle = require('../models/Vehicle');
const Client = require('../models/Client');
const emailService = require('../services/emailService');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorHandler');
const { normalizeItems, calculateTotals, materialChanged } = require('../utils/quoteData');

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

const endpoint = (handler) =>
  asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const status =
        error.name === 'VersionError'
          ? 409
          : error.status ||
            (error.name === 'ValidationError' || error.name === 'CastError' ? 400 : undefined);
      if (!status) throw error;
      res.status(status).json({
        success: false,
        error: {
          code: status === 409 ? 'QUOTE_CONFLICT' : 'INVALID_QUOTE',
          message:
            error.name === 'VersionError'
              ? 'El presupuesto cambió. Vuelva a abrirlo antes de guardar.'
              : error.message,
        },
      });
    }
  });

function snapshot(quote, userId, action) {
  const data = quote.toObject();
  const saved = {};
  for (const key of [
    'quoteNumber',
    'clientId',
    'vehicle',
    'vehicleId',
    'description',
    'proposedWork',
    'legacyProposedWork',
    'items',
    'includeIVA',
    'subtotal',
    'tax',
    'estimatedCost',
    'abonos',
    'totalAbonos',
    'saldoPendiente',
    'status',
    'validUntil',
    'notes',
    'emailSent',
    'emailSentAt',
  ])
    saved[key] = data[key];
  quote.history.push({
    version: quote.version || 0,
    changedAt: new Date(),
    changedBy: userId,
    action,
    quote: saved,
  });
}

async function getDocument(id, allowDeleted = false) {
  const quote = await Quote.findById(id);
  if (!quote || (!allowDeleted && quote.isDeleted)) fail(404, 'Presupuesto no encontrado');
  return quote;
}

async function invalidate(quote) {
  await cacheService.invalidateQuotes();
  await cacheService.delete(`cache:quote:${quote._id}`);
  await cacheService.invalidateClients();
}

async function applyData(quote, body, userId) {
  const previousDetail = quote.proposedWork;
  if (body.clientId !== undefined) {
    const client = await Client.findOne({ _id: body.clientId, isDeleted: false });
    if (!client) fail(400, 'Seleccione un cliente disponible');
    quote.clientId = client._id;
  }
  if (body.vehicleId) {
    const vehicle = await Vehicle.findOne({ _id: body.vehicleId, isActive: true });
    if (!vehicle || String(vehicle.cliente) !== String(quote.clientId?._id || quote.clientId))
      fail(400, 'El vehículo no pertenece al cliente seleccionado');
    quote.vehicleId = vehicle._id;
    quote.vehicle = {
      brand: vehicle.marca,
      model: vehicle.modelo,
      year: vehicle.año,
      licensePlate: vehicle.patente,
      mileage: body.vehicle?.mileage ?? vehicle.kilometraje,
    };
  } else if (body.vehicle !== undefined) {
    quote.vehicleId = undefined;
    quote.vehicle = body.vehicle || {};
  }
  for (const field of ['description', 'proposedWork', 'notes', 'includeIVA', 'validUntil']) {
    if (body[field] !== undefined) quote[field] = body[field];
  }
  if (body.items !== undefined) {
    if (!quote.items?.length && previousDetail?.trim() && !quote.legacyProposedWork)
      quote.legacyProposedWork = previousDetail;
    quote.items = normalizeItems(body.items);
    quote.proposedWork = quote.items
      .map(
        (item) =>
          `${item.name} — ${item.quantity} × $${item.price}${
            item.description ? `\n${item.description}` : ''
          }`
      )
      .join('\n');
  }
  if (body.abonos !== undefined) {
    quote.abonos = body.abonos.map((abono) => ({
      amount: abono.amount,
      date: abono.date || new Date(),
      notes: abono.notes || '',
      registeredBy: abono.registeredBy || userId,
    }));
  }
  if (quote.items?.length) {
    Object.assign(
      quote,
      calculateTotals(
        quote.items.map((item) => item.toObject()),
        quote.includeIVA,
        quote.abonos
      )
    );
  } else {
    if (!quote.proposedWork?.trim()) fail(400, 'Agregue al menos un trabajo o repuesto');
    if (body.estimatedCost !== undefined) quote.estimatedCost = body.estimatedCost;
    if (!Number.isSafeInteger(quote.estimatedCost) || quote.estimatedCost < 0)
      fail(400, 'Revise el importe del presupuesto');
  }
}

const listQuotes = endpoint(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const query = { isDeleted: req.query.trash === 'true' };
  if (req.query.status) query.status = req.query.status;
  if (req.query.clientId) query.clientId = req.query.clientId;
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
  }
  if (req.query.search) {
    const term = String(req.query.search)
      .trim()
      .slice(0, 150)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(term, 'i');
    const matchingClients = await Client.find(clientSearch(req.query.search)).select('_id').lean();
    query.$or = [
      { quoteNumber: regex },
      { 'vehicle.licensePlate': regex },
      { clientId: { $in: matchingClients.map((client) => client._id) } },
    ];
  }
  const sort = [
    'createdAt',
    '-createdAt',
    'quoteNumber',
    '-quoteNumber',
    'updatedAt',
    '-updatedAt',
  ].includes(req.query.sort)
    ? req.query.sort
    : '-createdAt';
  const [quotes, total] = await Promise.all([
    Quote.find(query)
      .select('-approvalTokens -requestId -history')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Quote.countDocuments(query),
  ]);
  res.json({
    success: true,
    data: { quotes, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
  });
});

const getQuote = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id, true);
  res.json({ success: true, data: { quote } });
});

const createQuote = endpoint(async (req, res) => {
  if (req.body.requestId) {
    const existing = await Quote.findOne({ requestId: req.body.requestId });
    if (existing) return res.json({ success: true, data: { quote: existing } });
  }
  const quote = new Quote({ requestId: req.body.requestId });
  await applyData(quote, req.body, req.userId);
  try {
    await quote.save();
  } catch (error) {
    if (error.code !== 11000 || !req.body.requestId) throw error;
    const existing = await Quote.findOne({ requestId: req.body.requestId });
    if (!existing) throw error;
    return res.json({ success: true, data: { quote: existing } });
  }
  await quote.populate('clientId');
  await invalidate(quote);
  res.status(201).json({ success: true, data: { quote } });
});

const updateQuote = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id);
  if (req.body.expectedVersion !== (quote.version || 0))
    fail(409, 'El presupuesto cambió. Vuelva a abrirlo antes de guardar.');
  const before = quote.toObject();
  snapshot(quote, req.userId, 'edited');
  await applyData(quote, req.body, req.userId);
  if (materialChanged(before, quote.toObject())) {
    if (quote.status === 'approved') quote.status = 'pending';
    quote.approvalTokens = [];
    quote.emailSent = false;
    quote.emailSentAt = undefined;
    if (quote.validUntil < new Date()) quote.validUntil = new Date(Date.now() + 7 * 86400000);
  }
  await quote.save();
  await invalidate(quote);
  res.json({ success: true, data: { quote } });
});

const duplicateQuote = endpoint(async (req, res) => {
  if (req.body.requestId) {
    const existing = await Quote.findOne({ requestId: req.body.requestId });
    if (existing) return res.json({ success: true, data: { quote: existing } });
  }
  const source = await getDocument(req.params.id, true);
  const data = source.toObject();
  const quote = new Quote({
    requestId: req.body.requestId,
    legacyProposedWork: data.legacyProposedWork,
  });
  await applyData(
    quote,
    {
      clientId: data.clientId?._id || data.clientId,
      vehicle: data.vehicle,
      vehicleId: data.vehicleId?._id || data.vehicleId,
      description: data.description,
      proposedWork: data.proposedWork,
      items: data.items,
      includeIVA: data.includeIVA,
      estimatedCost: data.estimatedCost,
      notes: data.notes,
    },
    req.userId
  );
  try {
    await quote.save();
  } catch (error) {
    if (error.code !== 11000 || !req.body.requestId) throw error;
    const existing = await Quote.findOne({ requestId: req.body.requestId });
    if (!existing) throw error;
    return res.json({ success: true, data: { quote: existing } });
  }
  await quote.populate('clientId');
  await invalidate(quote);
  res.status(201).json({ success: true, data: { quote } });
});

const getQuoteHistory = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id, true);
  res.json({ success: true, data: { history: quote.history } });
});

const deleteQuote = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id);
  snapshot(quote, req.userId, 'trashed');
  quote.isDeleted = true;
  quote.deletedAt = new Date();
  quote.deletedBy = req.userId;
  quote.approvalTokens = [];
  await quote.save();
  await invalidate(quote);
  res.json({ success: true, message: 'Presupuesto movido a la papelera' });
});

const restoreQuote = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id, true);
  if (quote.isDeleted) {
    snapshot(quote, req.userId, 'restored');
    quote.isDeleted = false;
    quote.deletedAt = null;
    quote.deletedBy = null;
    await quote.save();
    await invalidate(quote);
  }
  res.json({ success: true, data: { quote } });
});

const addAbono = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id);
  snapshot(quote, req.userId, 'payment_added');
  await quote.addAbono(req.body.amount, req.body.notes, req.userId);
  await invalidate(quote);
  res.json({ success: true, data: { quote } });
});

const removeAbono = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id);
  snapshot(quote, req.userId, 'payment_removed');
  await quote.removeAbono(Number(req.params.abonoIndex));
  await invalidate(quote);
  res.json({ success: true, data: { quote } });
});

const sendQuoteEmail = endpoint(async (req, res) => {
  const quote = await getDocument(req.params.id);
  if (quote.status !== 'pending') fail(400, 'El presupuesto ya fue procesado');
  const client = await Client.findById(quote.clientId?._id || quote.clientId);
  if (!client?.email) fail(400, 'Agregue un correo al cliente para enviarlo por email');
  const tokens = quote.generateTokens();
  await quote.save();
  const result = await emailService.sendQuoteEmail(quote, client, tokens);
  quote.emailAttempts += 1;
  if (result.success) {
    quote.emailSent = true;
    quote.emailSentAt = new Date();
  }
  await quote.save();
  await invalidate(quote);
  if (!result.success) fail(502, 'No se pudo enviar el correo. Puede volver a intentarlo.');
  res.json({
    success: true,
    message: 'Presupuesto enviado por correo',
    data: { emailSent: true, emailSentAt: quote.emailSentAt },
  });
});

async function setStatus(req, status, tokenType) {
  const quote = await getDocument(req.params.id);
  if (quote.status !== 'pending') fail(400, 'El presupuesto ya fue procesado');
  if (tokenType) {
    const validation = quote.validateToken(req.query.token);
    if (!validation.valid || validation.type !== tokenType)
      fail(400, validation.error || 'Este enlace no permite esa acción');
  }
  snapshot(quote, req.userId, status);
  quote.status = status;
  quote.approvalTokens.forEach((token) => {
    token.used = true;
    token.usedAt = new Date();
  });
  await quote.save();
  await invalidate(quote);
  return quote;
}

const approveQuoteManual = endpoint(async (req, res) => {
  const quote = await setStatus(req, 'approved');
  res.json({ success: true, message: 'Presupuesto aceptado', data: { quote } });
});
const rejectQuoteManual = endpoint(async (req, res) => {
  const quote = await setStatus(req, 'rejected');
  res.json({ success: true, message: 'Presupuesto rechazado', data: { quote } });
});
const approveQuote = endpoint(async (req, res) => {
  await setStatus(req, 'approved', 'approve');
  res.send(
    '<!doctype html><html lang="es"><meta charset="utf-8"><title>Presupuesto aceptado</title><body><h1>Presupuesto aceptado</h1><p>Su respuesta fue guardada. Puede contactar al taller para coordinar los siguientes pasos.</p></body></html>'
  );
});
const rejectQuote = endpoint(async (req, res) => {
  await setStatus(req, 'rejected', 'reject');
  res.send(
    '<!doctype html><html lang="es"><meta charset="utf-8"><title>Presupuesto rechazado</title><body><h1>Presupuesto rechazado</h1><p>Su respuesta fue guardada. Puede contactar al taller si necesita corregir el presupuesto.</p></body></html>'
  );
});

module.exports = {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  duplicateQuote,
  getQuoteHistory,
  restoreQuote,
  deleteQuote,
  addAbono,
  removeAbono,
  sendQuoteEmail,
  approveQuoteManual,
  rejectQuoteManual,
  approveQuote,
  rejectQuote,
};
