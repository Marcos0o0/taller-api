const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const {
  getGeneralStats,
  getMechanicsStats,
  getRecentActivity,
  getTrends
} = require('../controllers/dashboardController');

// Todas las rutas requieren admin
router.use(authenticate, authorize('admin'));

router.get('/stats', getGeneralStats);
router.get('/mechanics-stats', getMechanicsStats);
router.get('/recent-activity', getRecentActivity);
router.get('/trends', getTrends);

module.exports = router;