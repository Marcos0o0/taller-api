// controllers/dashboard.controller.js
const Quote = require('../models/Quote');
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const { asyncHandler } = require('../middlewares/errorHandler');

exports.getDashboardStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const end = endDate ? new Date(endDate) : new Date();
  
  const [
    presupuestos,
    ingresos,
    vehiculos,
    alertas,
    ingresosMensuales,
    productosCriticos,
    presupuestosPorEstado,
    serviciosMasComunes,
  ] = await Promise.all([
    // Presupuestos
    {
      total: await Quote.countDocuments({
        createdAt: { $gte: start, $lte: end },
        isDeleted: false,
      }),
      pendientes: await Quote.countDocuments({ status: 'pending' }),
      aprobados: await Quote.countDocuments({
        status: 'approved',
        createdAt: { $gte: start, $lte: end },
      }),
      completados: await Quote.countDocuments({
        status: 'completed',
        createdAt: { $gte: start, $lte: end },
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
          cobrado: {
            $sum: {
              $sum: '$abonos.amount',
            },
          },
        },
      },
    ]).then(result => result[0] || { total: 0, cobrado: 0 }),
    
    // Vehículos
    {
      total: await Quote.distinct('vehicleId', {
        createdAt: { $gte: start, $lte: end },
      }).then(ids => ids.length),
      enServicio: await Quote.countDocuments({
        status: 'approved',
        'workOrder.status': 'in_progress',
      }),
    },
    
    // Alertas
    {
      activas: await Alert.countDocuments({ estado: 'activa' }),
      criticas: await Alert.countDocuments({
        estado: 'activa',
        severidad: 'critica',
      }),
    },
    
    // Ingresos mensuales (últimos 6 meses)
    Quote.aggregate([
      {
        $match: {
          status: { $in: ['approved', 'completed'] },
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)),
          },
        },
      },
      {
        $group: {
          _id: {
            mes: { $month: '$createdAt' },
            año: { $year: '$createdAt' },
          },
          total: { $sum: '$estimatedCost' },
          cobrado: { $sum: { $sum: '$abonos.amount' } },
        },
      },
      { $sort: { '_id.año': 1, '_id.mes': 1 } },
    ]).then(results =>
      results.map(r => ({
        mes: `${r._id.mes}/${r._id.año}`,
        total: r.total,
        cobrado: r.cobrado,
      }))
    ),
    
    // ✅ Productos críticos (stock bajo o agotado) - ADAPTADO
    Product.find({
      $expr: { $lte: ['$stock', '$minStock'] }, // ✅ Cambiado de stock.cantidad a stock
      isActive: true, // ✅ Cambiado de activo a isActive
      isDeleted: false, // ✅ Agregado para excluir eliminados
    })
      .limit(10)
      .lean()
      .then(products =>
        products.map(p => ({
          nombre: p.name, // ✅ Cambiado de nombre a name
          codigo: p.barcode, // ✅ Cambiado de codigo a barcode
          cantidad: p.stock, // ✅ Cambiado de stock.cantidad a stock
          minimo: p.minStock, // ✅ Cambiado de stock.minimo a minStock
          categoria: p.category, // ✅ Agregado campo adicional
          ubicacion: p.location, // ✅ Agregado campo adicional
        }))
      ),
    
    // Presupuestos por estado
    Quote.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).then(results =>
      results.map(r => ({
        type: r._id,
        value: r.count,
      }))
    ),
    
    // Servicios más comunes
    Quote.aggregate([
      { $match: { isDeleted: false } },
      {
        $project: {
          services: {
            $cond: {
              if: { $isArray: '$proposedWork' },
              then: '$proposedWork',
              else: [],
            },
          },
        },
      },
      { $unwind: '$services' },
      { $group: { _id: '$services', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).then(results =>
      results.map(r => ({
        servicio: r._id,
        cantidad: r.count,
      }))
    ),
  ]);
  
  res.json({
    success: true,
    data: {
      presupuestos,
      ingresos,
      vehiculos,
      alertas,
      ingresosMensuales,
      productosCriticos, // ✅ Renombrado de repuestosCriticos
      presupuestosPorEstado,
      serviciosMasComunes,
    },
  });
});

// ✅ NUEVO: Endpoint adicional para estadísticas de inventario
exports.getInventoryStats = asyncHandler(async (req, res) => {
  const [
    totalProductos,
    productosActivos,
    productosStockBajo,
    productosAgotados,
    valorInventario,
    productosPorCategoria,
    movimientosRecientes,
  ] = await Promise.all([
    // Total de productos
    Product.countDocuments({ isDeleted: false }),
    
    // Productos activos
    Product.countDocuments({ isActive: true, isDeleted: false }),
    
    // Productos con stock bajo
    Product.countDocuments({
      $expr: { $lte: ['$stock', '$minStock'] },
      stock: { $gt: 0 },
      isActive: true,
      isDeleted: false,
    }),
    
    // Productos agotados
    Product.countDocuments({
      stock: 0,
      isActive: true,
      isDeleted: false,
    }),
    
    // Valor total del inventario
    Product.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          valorCosto: { $sum: { $multiply: ['$costPrice', '$stock'] } },
          valorVenta: { $sum: { $multiply: ['$price', '$stock'] } },
        },
      },
    ]).then(result => result[0] || { valorCosto: 0, valorVenta: 0 }),
    
    // Productos por categoría
    Product.aggregate([
      { $match: { isDeleted: false, isActive: true } },
      {
        $group: {
          _id: '$category',
          cantidad: { $sum: 1 },
          stockTotal: { $sum: '$stock' },
        },
      },
      { $sort: { cantidad: -1 } },
    ]),
    
    // Movimientos recientes (últimos 7 días)
    Product.aggregate([
      {
        $match: {
          isDeleted: false,
          'stockMovements.createdAt': {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      { $unwind: '$stockMovements' },
      {
        $match: {
          'stockMovements.createdAt': {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: '$stockMovements.type',
          cantidad: { $sum: 1 },
          total: { $sum: '$stockMovements.quantity' },
        },
      },
    ]),
  ]);
  
  res.json({
    success: true,
    data: {
      resumen: {
        totalProductos,
        productosActivos,
        productosStockBajo,
        productosAgotados,
      },
      valorInventario,
      productosPorCategoria: productosPorCategoria.map(cat => ({
        categoria: cat._id,
        cantidad: cat.cantidad,
        stockTotal: cat.stockTotal,
      })),
      movimientosRecientes: movimientosRecientes.map(mov => ({
        tipo: mov._id,
        cantidad: mov.cantidad,
        total: mov.total,
      })),
    },
  });
});

module.exports = exports;