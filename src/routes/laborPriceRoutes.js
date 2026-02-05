// routes/laborPrice.routes.js

const express = require('express');
const router = express.Router();
const laborPriceController = require('../controllers/laborPriceController');

// Middleware de autenticación (ajusta según tu implementación)
// const { protect, authorize } = require('../middleware/auth');

// ==========================================
// RUTAS PÚBLICAS (o protegidas según necesites)
// ==========================================

// Categorías
router.get('/categories', laborPriceController.getAllCategories);
router.get('/categories/:id', laborPriceController.getCategoryById);

// Servicios
router.get('/services', laborPriceController.getAllServices);
router.get('/services/search', laborPriceController.searchServices);
router.get('/services/:id', laborPriceController.getServiceById);

// Estadísticas
router.get('/stats', laborPriceController.getStats);

// ==========================================
// RUTAS PROTEGIDAS (Solo admin)
// ==========================================
// Descomenta y ajusta según tu middleware de autenticación

// Categorías - Admin
// router.post('/categories', protect, authorize('admin'), laborPriceController.createCategory);
// router.put('/categories/:id', protect, authorize('admin'), laborPriceController.updateCategory);
// router.delete('/categories/:id', protect, authorize('admin'), laborPriceController.deleteCategory);

// Servicios - Admin
// router.post('/services', protect, authorize('admin'), laborPriceController.createService);
// router.put('/services/:id', protect, authorize('admin'), laborPriceController.updateService);
// router.delete('/services/:id', protect, authorize('admin'), laborPriceController.deleteService);

module.exports = router;