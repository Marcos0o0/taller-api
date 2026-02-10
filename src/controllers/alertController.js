// controllers/alertController.js
const Alert = require('../models/Alert');
const alertService = require('../services/alertService');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Listar alertas
// @route   GET /api/alerts
// @access  Admin
exports.listAlerts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    tipo,
    severidad,
    estado = 'activa',
    sort = '-fechaCreacion',
  } = req.query;
  
  const query = {};
  
  if (tipo) query.tipo = tipo;
  if (severidad) query.severidad = severidad;
  if (estado) query.estado = estado;
  
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [alertas, total] = await Promise.all([
    Alert.find(query)
      .populate('repuesto', 'codigo nombre categoria stock')
      .populate('resueltoPor', 'nombre email')
      .sort(sort)
      .limit(parseInt(limit))
      .skip(skip)
      .lean(),
    Alert.countDocuments(query),
  ]);
  
  res.json({
    success: true,
    data: {
      alertas,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

// @desc    Obtener estadísticas de alertas
// @route   GET /api/alerts/stats
// @access  Admin
exports.getAlertStats = asyncHandler(async (req, res) => {
  const stats = await alertService.obtenerEstadisticas();
  
  res.json({
    success: true,
    data: stats,
  });
});

// @desc    Marcar alerta como vista
// @route   PUT /api/alerts/:id/mark-viewed
// @access  Admin
exports.markAlertViewed = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const alerta = await Alert.findById(id);
  
  if (!alerta) {
    return res.status(404).json({
      success: false,
      error: { message: 'Alerta no encontrada' },
    });
  }
  
  await alerta.marcarVista(req.userId);
  
  res.json({
    success: true,
    data: { alerta },
    message: 'Alerta marcada como vista',
  });
});

// @desc    Resolver alerta
// @route   PUT /api/alerts/:id/resolve
// @access  Admin
exports.resolveAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body;
  
  const alerta = await Alert.findById(id);
  
  if (!alerta) {
    return res.status(404).json({
      success: false,
      error: { message: 'Alerta no encontrada' },
    });
  }
  
  await alerta.resolver(req.userId, notas);
  
  // Emitir actualización
  alertService.emitirActualizacionAlertas();
  
  res.json({
    success: true,
    data: { alerta },
    message: 'Alerta resuelta exitosamente',
  });
});

// @desc    Descartar alerta
// @route   PUT /api/alerts/:id/dismiss
// @access  Admin
exports.dismissAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const alerta = await Alert.findById(id);
  
  if (!alerta) {
    return res.status(404).json({
      success: false,
      error: { message: 'Alerta no encontrada' },
    });
  }
  
  alerta.estado = 'descartada';
  alerta.acciones.push({
    tipo: 'descartado',
    descripcion: 'Alerta descartada',
    usuario: req.userId,
  });
  
  await alerta.save();
  
  alertService.emitirActualizacionAlertas();
  
  res.json({
    success: true,
    data: { alerta },
    message: 'Alerta descartada',
  });
});

// @desc    Forzar verificación de alertas
// @route   POST /api/alerts/check
// @access  Admin
exports.forceAlertCheck = asyncHandler(async (req, res) => {
  await alertService.verificarTodasLasAlertas();
  
  res.json({
    success: true,
    message: 'Verificación de alertas completada',
  });
});

module.exports = exports;