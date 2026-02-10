// controllers/dashboardController.js
const Quote = require('../models/Quote');
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const User = require('../models/User');
const { asyncHandler } = require('../middlewares/errorHandler');

/**
 * Obtener estadísticas generales del dashboard
 */
exports.getGeneralStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  
  const [
    presupuestos,
    ingresos,
    vehiculos,
    alertas,
    productosCriticos,
    ordenesActivas,
  ] = await Promise.all([
    // Presupuestos
    {
      total: await Quote.countDocuments({
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      pendientes: await Quote.countDocuments({ 
        status: 'pending',
        isDeleted: false,
      }),
      aprobados: await Quote.countDocuments({
        status: 'approved',
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      completados: await Quote.countDocuments({
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      rechazados: await Quote.countDocuments({
        status: 'rejected',
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
    },
    
    // Ingresos
    Quote.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'completed'] },
          createdAt: { $gte: start, $lte: end },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$estimatedCost' },
          promedio: { $avg: '$estimatedCost' },
        },
      },
    ]).then(result => result[0] || { total: 0, promedio: 0 }),
    
    // Vehículos únicos atendidos
    Quote.distinct('vehicleId', {
      createdAt: { $gte: start, $lte: end },
      isDeleted: false,
    }).then(ids => ids.length),
    
    // Alertas activas
    {
      activas: await Alert.countDocuments({ estado: 'activa' }).catch(() => 0),
      criticas: await Alert.countDocuments({
        estado: 'activa',
        severidad: 'critica',
      }).catch(() => 0),
      altas: await Alert.countDocuments({
        estado: 'activa',
        severidad: 'alta',
      }).catch(() => 0),
    },
    
    // Productos con stock crítico
    Product.countDocuments({
      $expr: { $lte: ['$stock', '$minStock'] },
      isActive: true,
      isDeleted: false,
    }).catch(() => 0),
    
    // ✅ Órdenes de trabajo activas (dentro de quotes con workOrder)
    Quote.countDocuments({
      'workOrder': { $exists: true },
      'workOrder.status': { $in: ['pending', 'in_progress'] },
      isDeleted: false,
    }).catch(() => 0),
  ]);
  
  res.json({
    success: true,
    data: {
      presupuestos,
      ingresos,
      vehiculos,
      alertas,
      inventario: {
        productosCriticos,
      },
      ordenesActivas,
      periodo: {
        inicio: start,
        fin: end,
      },
    },
  });
});

/**
 * Obtener estadísticas de mecánicos
 */
exports.getMechanicsStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();

  // Obtener mecánicos con sus estadísticas
  const mechanics = await User.find({
    role: 'mechanic',
    isActive: true,
  }).select('name email');

  const mechanicsStats = await Promise.all(
    mechanics.map(async (mechanic) => {
      const [
        trabajosCompletados,
        trabajosEnProceso,
        totalIngresos,
        promedioTiempoEntrega
      ] = await Promise.all([
        // Trabajos completados
        Quote.countDocuments({
          mechanicId: mechanic._id,
          status: 'completed',
          createdAt: { $gte: start, $lte: end },
          isDeleted: false,
        }),
        
        // Trabajos en proceso (con workOrder activo)
        Quote.countDocuments({
          mechanicId: mechanic._id,
          'workOrder.status': 'in_progress',
          isDeleted: false,
        }),
        
        // Total de ingresos generados
        Quote.aggregate([
          {
            $match: {
              mechanicId: mechanic._id,
              status: { $in: ['approved', 'completed'] },
              createdAt: { $gte: start, $lte: end },
              isDeleted: false,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$estimatedCost' },
            },
          },
        ]).then(result => result[0]?.total || 0),
        
        // Promedio de tiempo de entrega (en días)
        Quote.aggregate([
          {
            $match: {
              mechanicId: mechanic._id,
              status: 'completed',
              'workOrder.completedAt': { $exists: true },
              createdAt: { $gte: start, $lte: end },
              isDeleted: false,
            },
          },
          {
            $project: {
              diasTrabajo: {
                $divide: [
                  { $subtract: ['$workOrder.completedAt', '$createdAt'] },
                  1000 * 60 * 60 * 24 // Convertir ms a días
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              promedio: { $avg: '$diasTrabajo' }
            }
          }
        ]).then(result => Math.round(result[0]?.promedio || 0)),
      ]);

      return {
        mecanico: {
          id: mechanic._id,
          nombre: mechanic.name,
          email: mechanic.email,
        },
        trabajosCompletados,
        trabajosEnProceso,
        totalIngresos,
        promedioTiempoEntrega, // en días
      };
    })
  );

  res.json({
    success: true,
    data: mechanicsStats,
  });
});

/**
 * Obtener actividad reciente
 */
exports.getRecentActivity = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;

  const [recentQuotes, recentAlerts, recentWorkOrders] = await Promise.all([
    // Cotizaciones recientes
    Quote.find({ isDeleted: false })
      .populate('clientId', 'name email phone')
      .populate('mechanicId', 'name')
      .sort('-createdAt')
      .limit(limit)
      .lean(),

    // Alertas recientes
    Alert.find({ estado: 'activa' })
      .populate('producto', 'name barcode stock minStock')
      .sort('-fechaCreacion')
      .limit(limit)
      .lean()
      .catch(() => []),
      
    // ✅ Órdenes de trabajo recientes (extraídas de quotes)
    Quote.find({
      'workOrder': { $exists: true },
      isDeleted: false,
    })
      .populate('clientId', 'name')
      .populate('mechanicId', 'name')
      .sort('-workOrder.startedAt')
      .limit(limit)
      .lean()
      .catch(() => []),
  ]);

  res.json({
    success: true,
    data: {
      cotizaciones: recentQuotes.map(quote => ({
        id: quote._id,
        cliente: quote.clientId?.name || 'Cliente no encontrado',
        vehiculo: `${quote.vehicle?.brand} ${quote.vehicle?.model} ${quote.vehicle?.year || ''}`.trim(),
        patente: quote.vehicle?.licensePlate,
        estado: quote.status,
        costo: quote.estimatedCost,
        fecha: quote.createdAt,
      })),
      alertas: recentAlerts.map(alert => ({
        id: alert._id,
        tipo: alert.tipo,
        severidad: alert.severidad,
        titulo: alert.titulo,
        producto: alert.producto?.name || 'N/A',
        stock: alert.producto?.stock,
        fecha: alert.fechaCreacion,
      })),
      ordenesActivas: recentWorkOrders
        .filter(quote => quote.workOrder)
        .map(quote => ({
          id: quote._id,
          cliente: quote.clientId?.name || 'N/A',
          mecanico: quote.mechanicId?.name || 'No asignado',
          vehiculo: `${quote.vehicle?.brand} ${quote.vehicle?.model}`.trim(),
          estado: quote.workOrder.status,
          inicio: quote.workOrder.startedAt,
          progreso: quote.workOrder.progress || 0,
        })),
    },
  });
});

/**
 * Obtener tendencias (últimos 6 meses)
 */
exports.getTrends = asyncHandler(async (req, res) => {
  const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 6));

  const [ingresosMensuales, presupuestosPorEstado, serviciosMasComunes, vehiculosMasAtendidos] = await Promise.all([
    // Ingresos mensuales
    Quote.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'completed'] },
          createdAt: { $gte: sixMonthsAgo },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: {
            mes: { $month: '$createdAt' },
            año: { $year: '$createdAt' },
          },
          total: { $sum: '$estimatedCost' },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } },
    ]),

    // Presupuestos por estado
    Quote.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Servicios más comunes (basado en proposedWork)
    Quote.aggregate([
      { $match: { isDeleted: false, proposedWork: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: {
            $substr: ['$proposedWork', 0, 50] // Primeros 50 caracteres como identificador
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    
    // ✅ Marcas de vehículos más atendidas
    Quote.aggregate([
      {
        $match: {
          isDeleted: false,
          'vehicle.brand': { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$vehicle.brand',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const mesesNombre = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  res.json({
    success: true,
    data: {
      ingresosMensuales: ingresosMensuales.map(item => ({
        mes: `${mesesNombre[item._id.mes - 1]} ${item._id.año}`,
        total: item.total,
        cantidad: item.cantidad,
        promedio: item.cantidad > 0 ? Math.round(item.total / item.cantidad) : 0,
      })),
      presupuestosPorEstado: presupuestosPorEstado.map(item => ({
        estado: item._id,
        cantidad: item.count,
      })),
      serviciosMasComunes: serviciosMasComunes.map((item, index) => ({
        id: index + 1,
        servicio: item._id,
        cantidad: item.count,
      })),
      vehiculosMasAtendidos: vehiculosMasAtendidos.map(item => ({
        marca: item._id,
        cantidad: item.count,
      })),
    },
  });
});

module.exports = exports;