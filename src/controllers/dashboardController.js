// 📁 Archivo: backend/src/controllers/dashboardController.js

const Quote = require('../models/Quote');
const Client = require('../models/Client');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Obtener estadísticas generales
// @route   GET /api/dashboard/stats
// @access  Admin
const getGeneralStats = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const cacheKey = `cache:dashboard:general:${userId}`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  // Fecha de hace 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Fecha de hace 30 días
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // === ÓRDENES (usando Quote con workOrder) ===
  const quotesWithOrders = await Quote.find({
    workOrder: { $exists: true, $ne: null },
    isDeleted: false
  }).lean();

  const totalOrders = quotesWithOrders.length;
  
  const ordersByStatus = quotesWithOrders.reduce((acc, quote) => {
    const status = quote.workOrder.status;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const completedOrders = quotesWithOrders.filter(
    q => q.workOrder.status === 'entregado'
  ).length;

  const recentOrders = quotesWithOrders.filter(
    q => new Date(q.workOrder.createdAt) >= thirtyDaysAgo
  ).length;

  const orderStats = {
    total: totalOrders,
    pendiente_asignacion: ordersByStatus['pendiente_asignacion'] || 0,
    en_progreso: ordersByStatus['en_progreso'] || 0,
    listo: ordersByStatus['listo'] || 0,
    entregado: ordersByStatus['entregado'] || 0,
  };

  // === COTIZACIONES ===
  const [totalQuotes, quotesByStatus] = await Promise.all([
    Quote.countDocuments({ isDeleted: false }),
    Quote.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
  ]);

  const quoteStats = {
    total: totalQuotes,
    pending: quotesByStatus.find(s => s._id === 'pending')?.count || 0,
    approved: quotesByStatus.find(s => s._id === 'approved')?.count || 0,
    rejected: quotesByStatus.find(s => s._id === 'rejected')?.count || 0,
  };

  // === INGRESOS ===
  const completedQuotes = quotesWithOrders.filter(
    q => q.workOrder.status === 'entregado' && q.workOrder.finalCost
  );

  const totalRevenue = completedQuotes.reduce(
    (sum, q) => sum + (q.workOrder.finalCost || 0),
    0
  );

  const averageOrderValue = completedQuotes.length > 0 
    ? totalRevenue / completedQuotes.length 
    : 0;

  // === CLIENTES ===
  const [totalClients, newClientsThisMonth] = await Promise.all([
    Client.countDocuments({ isDeleted: false }),
    Client.countDocuments({ 
      isDeleted: false,
      createdAt: { 
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
      } 
    }),
  ]);

  const result = {
    revenue: {
      total: totalRevenue,
      averageOrderValue: Math.round(averageOrderValue),
      completedOrders: completedQuotes.length,
    },
    orders: orderStats,
    quotes: quoteStats,
    clients: {
      total: totalClients,
      newThisMonth: newClientsThisMonth,
    },
    recentActivity: {
      ordersLast30Days: recentOrders,
    },
  };

  await cacheService.set(cacheKey, result, 300);

  res.json({
    success: true,
    data: result,
  });
});

// @desc    Obtener estadísticas de mecánicos
// @route   GET /api/dashboard/mechanics-stats
// @access  Admin
const getMechanicsStats = asyncHandler(async (req, res) => {
  // Por ahora devolver datos vacíos si no existe el modelo User
  res.json({
    success: true,
    data: {
      mechanics: []
    },
  });
});

// @desc    Obtener actividad reciente
// @route   GET /api/dashboard/recent-activity
// @access  Admin
const getRecentActivity = asyncHandler(async (req, res) => {
  const cacheKey = `cache:dashboard:recent`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  // Servicios recientes
  const recentServices = await Quote.aggregate([
    { 
      $match: { 
        isDeleted: false,
        'workOrder.status': { $in: ['en_progreso', 'listo', 'entregado'] } 
      } 
    },
    { $sort: { 'workOrder.updatedAt': -1 } },
    { $limit: 10 },
    { $unwind: '$services' },
    {
      $lookup: {
        from: 'clients',
        localField: 'clientId',
        foreignField: '_id',
        as: 'client'
      }
    },
    { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: '$services._id',
        name: '$services.name',
        price: '$services.price',
        clientName: {
          $concat: [
            { $ifNull: ['$client.firstName', ''] },
            ' ',
            { $ifNull: ['$client.lastName1', ''] }
          ]
        },
        createdAt: '$workOrder.createdAt'
      }
    },
    { $limit: 5 }
  ]);

  const result = {
    recentServices,
    lowStockProducts: [], // Vacío por ahora si no existe Product
  };

  await cacheService.set(cacheKey, result, 300);

  res.json({
    success: true,
    data: result,
  });
});

// @desc    Obtener tendencias
// @route   GET /api/dashboard/trends
// @access  Admin
const getTrends = asyncHandler(async (req, res) => {
  const cacheKey = `cache:dashboard:trends`;
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Ingresos mensuales
  const quotesWithOrders = await Quote.find({
    workOrder: { $exists: true, $ne: null },
    isDeleted: false,
    'workOrder.status': 'entregado',
    'workOrder.createdAt': { $gte: sixMonthsAgo }
  }).lean();

  const monthlyRevenueMap = quotesWithOrders.reduce((acc, quote) => {
    const date = new Date(quote.workOrder.createdAt);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const key = `${year}-${month}`;
    
    if (!acc[key]) {
      acc[key] = { month, year, total: 0, count: 0 };
    }
    
    acc[key].total += quote.workOrder.finalCost || 0;
    acc[key].count += 1;
    
    return acc;
  }, {});

  const monthlyRevenue = Object.values(monthlyRevenueMap)
    .sort((a, b) => a.year - b.year || a.month - b.month);

  // Servicios más vendidos
  const topServices = await Quote.aggregate([
    { 
      $match: { 
        isDeleted: false,
        'workOrder.status': 'entregado' 
      } 
    },
    { $unwind: '$services' },
    {
      $group: {
        _id: '$services.name',
        name: { $first: '$services.name' },
        count: { $sum: 1 },
        total: { $sum: '$services.price' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);

  const result = {
    monthlyRevenue,
    topServices,
  };

  await cacheService.set(cacheKey, result, 300);

  res.json({
    success: true,
    data: result,
  });
});

module.exports = {
  getGeneralStats,
  getMechanicsStats,
  getRecentActivity,
  getTrends,
};