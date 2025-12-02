const User = require('../models/User');
const Client = require('../models/Client');
const Quote = require('../models/Quote');
const WorkOrder = require('../models/WorkOrder');
const Mechanic = require('../models/Mechanic');
const cacheService = require('../services/cacheService');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Obtener estadísticas generales del taller
// @route   GET /api/dashboard/stats
// @access  Admin
const getGeneralStats = asyncHandler(async (req, res) => {
  // Intentar obtener desde caché
  const cacheKey = 'cache:dashboard:general-stats';
  const cached = await cacheService.get(cacheKey);
  
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true
    });
  }

  // Obtener conteos generales
  const [
    totalClients,
    totalActiveClients,
    totalQuotes,
    totalOrders,
    totalMechanics,
    activeMechanics
  ] = await Promise.all([
    Client.countDocuments({ isDeleted: false }),
    Client.countDocuments({ isDeleted: false, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
    Quote.countDocuments({ isDeleted: false }),
    WorkOrder.countDocuments({ isDeleted: false }),
    Mechanic.countDocuments({ isDeleted: false }),
    Mechanic.countDocuments({ isDeleted: false, isActive: true })
  ]);

  // Estadísticas de presupuestos por estado
  const quotesByStatus = await Quote.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const quotesStats = {
    pending: quotesByStatus.find(q => q._id === 'pending')?.count || 0,
    approved: quotesByStatus.find(q => q._id === 'approved')?.count || 0,
    rejected: quotesByStatus.find(q => q._id === 'rejected')?.count || 0,
    total: totalQuotes
  };

  // Estadísticas de órdenes por estado
  const ordersByStatus = await WorkOrder.aggregate([
    { $match: { isDeleted: false } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const ordersStats = {
    pendiente_asignacion: ordersByStatus.find(o => o._id === 'pendiente_asignacion')?.count || 0,
    asignada: ordersByStatus.find(o => o._id === 'asignada')?.count || 0,
    en_progreso: ordersByStatus.find(o => o._id === 'en_progreso')?.count || 0,
    listo: ordersByStatus.find(o => o._id === 'listo')?.count || 0,
    entregado: ordersByStatus.find(o => o._id === 'entregado')?.count || 0,
    total: totalOrders
  };

  // Calcular ingresos totales (órdenes entregadas con costo final)
  const revenueResult = await WorkOrder.aggregate([
    { 
      $match: { 
        isDeleted: false, 
        status: 'entregado',
        finalCost: { $exists: true, $ne: null }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: '$finalCost' },
        count: { $sum: 1 }
      } 
    }
  ]);

  const revenue = {
    total: revenueResult[0]?.total || 0,
    completedOrders: revenueResult[0]?.count || 0,
    averageOrderValue: revenueResult[0]?.count 
      ? Math.round(revenueResult[0].total / revenueResult[0].count) 
      : 0
  };

  // Órdenes de los últimos 30 días
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentOrders = await WorkOrder.countDocuments({
    isDeleted: false,
    createdAt: { $gte: thirtyDaysAgo }
  });

  const result = {
    clients: {
      total: totalClients,
      newThisMonth: totalActiveClients
    },
    quotes: quotesStats,
    orders: ordersStats,
    mechanics: {
      total: totalMechanics,
      active: activeMechanics
    },
    revenue,
    recentActivity: {
      ordersLast30Days: recentOrders
    }
  };

  // Guardar en caché por 5 minutos
  await cacheService.set(cacheKey, result, 300);

  res.json({
    success: true,
    data: result
  });
});

// @desc    Obtener estadísticas por mecánico
// @route   GET /api/dashboard/mechanics-stats
// @access  Admin
const getMechanicsStats = asyncHandler(async (req, res) => {
  const mechanics = await Mechanic.find({ isDeleted: false, isActive: true })
    .populate('userId', 'username')
    .lean();

  const mechanicsStats = await Promise.all(
    mechanics.map(async (mechanic) => {
      // Órdenes asignadas
      const orders = await WorkOrder.find({ 
        mechanicId: mechanic._id,
        isDeleted: false 
      }).lean();

      // Estadísticas
      const activeOrders = orders.filter(o => 
        ['asignada', 'en_progreso', 'listo'].includes(o.status)
      ).length;

      const completedOrders = orders.filter(o => 
        o.status === 'entregado'
      ).length;

      // Tiempo promedio de completado
      const completedWithTime = orders.filter(o => 
        o.status === 'entregado' && o.actualDelivery && o.createdAt
      );

      let avgCompletionTime = 0;
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, o) => {
          const diffMs = new Date(o.actualDelivery) - new Date(o.createdAt);
          const diffHours = diffMs / (1000 * 60 * 60);
          return sum + diffHours;
        }, 0);
        avgCompletionTime = Math.round(totalTime / completedWithTime.length / 24 * 10) / 10;
      }

      return {
        mechanicId: mechanic._id,
        name: `${mechanic.firstName} ${mechanic.lastName1}`,
        username: mechanic.userId?.username,
        activeOrders,
        completedOrders,
        totalOrders: orders.length,
        avgCompletionTime: `${avgCompletionTime} días`
      };
    })
  );

  res.json({
    success: true,
    data: { mechanicsStats }
  });
});

// @desc    Obtener actividad reciente
// @route   GET /api/dashboard/recent-activity
// @access  Admin
const getRecentActivity = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Últimos presupuestos creados
  const recentQuotes = await Quote.find({ isDeleted: false })
    .populate('clientId', 'firstName lastName1 email')
    .sort('-createdAt')
    .limit(parseInt(limit))
    .select('quoteNumber status estimatedCost createdAt')
    .lean();

  // Últimas órdenes actualizadas
  const recentOrders = await WorkOrder.find({ isDeleted: false })
    .populate({
      path: 'quoteId',
      populate: { path: 'clientId', select: 'firstName lastName1' }
    })
    .populate('mechanicId', 'firstName lastName1')
    .sort('-updatedAt')
    .limit(parseInt(limit))
    .select('orderNumber status updatedAt')
    .lean();

  // Presupuestos pendientes de respuesta (enviados pero no respondidos)
  const pendingQuotes = await Quote.find({
    isDeleted: false,
    status: 'pending',
    emailSent: true
  })
    .populate('clientId', 'firstName lastName1 email')
    .sort('-emailSentAt')
    .limit(parseInt(limit))
    .select('quoteNumber emailSentAt validUntil')
    .lean();

  res.json({
    success: true,
    data: {
      recentQuotes,
      recentOrders,
      pendingQuotes
    }
  });
});

// @desc    Obtener tendencias (últimos 7 días)
// @route   GET /api/dashboard/trends
// @access  Admin
const getTrends = asyncHandler(async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Presupuestos por día
  const quotesTrend = await Quote.aggregate([
    { 
      $match: { 
        isDeleted: false,
        createdAt: { $gte: sevenDaysAgo }
      } 
    },
    {
      $group: {
        _id: { 
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Órdenes por día
  const ordersTrend = await WorkOrder.aggregate([
    { 
      $match: { 
        isDeleted: false,
        createdAt: { $gte: sevenDaysAgo }
      } 
    },
    {
      $group: {
        _id: { 
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Completadas por día
  const completedTrend = await WorkOrder.aggregate([
    { 
      $match: { 
        isDeleted: false,
        status: 'entregado',
        actualDelivery: { $gte: sevenDaysAgo }
      } 
    },
    {
      $group: {
        _id: { 
          $dateToString: { format: '%Y-%m-%d', date: '$actualDelivery' }
        },
        count: { $sum: 1 },
        revenue: { $sum: '$finalCost' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      quotes: quotesTrend,
      orders: ordersTrend,
      completed: completedTrend
    }
  });
});

module.exports = {
  getGeneralStats,
  getMechanicsStats,
  getRecentActivity,
  getTrends
};