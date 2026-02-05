const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
  getGeneralStats,
  getMechanicsStats,
  getRecentActivity,
  getTrends
} = require('../controllers/dashboardController');

// Debug: Verificar que las funciones existan
console.log('Dashboard Controller Functions:', {
  getGeneralStats: typeof getGeneralStats,
  getMechanicsStats: typeof getMechanicsStats,
  getRecentActivity: typeof getRecentActivity,
  getTrends: typeof getTrends
});

// Todas las rutas requieren autenticación y autorización de admin
router.use(authenticate, authorize('admin'));

router.get('/stats', getGeneralStats);
router.get('/mechanics-stats', getMechanicsStats);
router.get('/recent-activity', getRecentActivity);
router.get('/trends', getTrends);

module.exports = router;