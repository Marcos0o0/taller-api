// routes/alertsRoutes.js
const express = require('express');
const router = express.Router();
const {
  listAlerts,
  getAlertStats,
  markAlertViewed,
  resolveAlert,
  dismissAlert,
  forceAlertCheck,
} = require('../controllers/alertController');
const { authenticate, authorize } = require('../middlewares/auth');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Listar alertas
router.get('/', authorize('admin', 'gerente'), listAlerts);

// Estadísticas
router.get('/stats', authorize('admin', 'gerente'), getAlertStats);

// Forzar verificación
router.post('/check', authorize('admin'), forceAlertCheck);

// Marcar como vista
router.put('/:id/mark-viewed', authorize('admin', 'gerente'), markAlertViewed);

// Resolver alerta
router.put('/:id/resolve', authorize('admin', 'gerente'), resolveAlert);

// Descartar alerta
router.put('/:id/dismiss', authorize('admin', 'gerente'), dismissAlert);

module.exports = router;