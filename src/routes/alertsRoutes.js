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

// ✅ NUEVA RUTA: Test de notificaciones (TEMPORAL - Solo desarrollo)
router.post('/test', authorize('admin', 'gerente'), (req, res) => {
  try {
    console.log('[TEST] Endpoint /api/alerts/test llamado');
    
    // Crear alerta de prueba
    const alertaTest = {
      _id: 'test-' + Date.now(),
      tipo: 'stock_bajo',
      severidad: 'alta',
      titulo: 'Test desde Backend',
      mensaje: 'Esta alerta fue generada desde el endpoint /api/alerts/test para verificar que las notificaciones funcionan correctamente',
      repuesto: {
        _id: 'repuesto-test-123',
        name: 'Filtro de Aceite (TEST)',
        codigo: 'TEST-001',
        stock: 2,
        minStock: 10,
      },
      datos: {
        stockActual: 2,
        stockMinimo: 10,
      },
      estado: 'activa',
      fechaCreacion: new Date(),
    };

    // Emitir por WebSocket
    console.log('[TEST] Emitiendo alerta por WebSocket...');
    
    // Obtener io desde req.app (asegúrate que esté disponible)
    const io = req.app.get('io');
    
    if (!io) {
      console.error('[TEST] Socket.io no está disponible en req.app');
      return res.status(500).json({ 
        success: false, 
        error: 'Socket.io no configurado',
        hint: 'Verifica que io esté disponible en app.set("io", io)' 
      });
    }
    
    io.emit('nueva-alerta', alertaTest);
    console.log('[TEST] Alerta emitida por WebSocket');
    console.log('[TEST] Clientes conectados:', io.engine.clientsCount);
    
    res.json({ 
      success: true, 
      message: 'Alerta de prueba enviada por WebSocket',
      alerta: alertaTest,
      clientesConectados: io.engine.clientsCount,
      note: 'Revisa el frontend - la notificación debería aparecer en 1-2 segundos'
    });
    
  } catch (error) {
    console.error('[TEST] Error en endpoint de prueba:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Marcar como vista
router.put('/:id/mark-viewed', authorize('admin', 'gerente'), markAlertViewed);

// Resolver alerta
router.put('/:id/resolve', authorize('admin', 'gerente'), resolveAlert);

// Descartar alerta
router.put('/:id/dismiss', authorize('admin', 'gerente'), dismissAlert);

module.exports = router;