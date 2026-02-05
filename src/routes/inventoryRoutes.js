const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listProducts,
  getProduct,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  addStockMovement,
  getStockMovements,
  getLowStockProducts,
  getInventoryStats,
  exportInventory
} = require('../controllers/inventoryController');

// Todas las rutas requieren autenticación y rol admin
router.use(authenticate, authorize('admin'));

// Validaciones
const createProductValidation = [
  body('barcode')
    .trim()
    .notEmpty()
    .withMessage('Código de barras es obligatorio')
    .isLength({ max: 50 })
    .withMessage('Código de barras no puede exceder 50 caracteres'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nombre es obligatorio')
    .isLength({ max: 200 })
    .withMessage('Nombre no puede exceder 200 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Descripción no puede exceder 1000 caracteres'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Categoría es obligatoria')
    .isLength({ max: 100 })
    .withMessage('Categoría no puede exceder 100 caracteres'),
  body('price')
    .notEmpty()
    .withMessage('Precio es obligatorio')
    .isFloat({ min: 0 })
    .withMessage('Precio debe ser mayor o igual a 0'),
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Precio de costo debe ser mayor o igual a 0'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock debe ser mayor o igual a 0'),
  body('minStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock mínimo debe ser mayor o igual a 0'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Ubicación no puede exceder 100 caracteres'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Proveedor no puede exceder 200 caracteres')
];

const updateProductValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nombre no puede estar vacío')
    .isLength({ max: 200 })
    .withMessage('Nombre no puede exceder 200 caracteres'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Descripción no puede exceder 1000 caracteres'),
  body('category')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Categoría no puede estar vacía')
    .isLength({ max: 100 })
    .withMessage('Categoría no puede exceder 100 caracteres'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Precio debe ser mayor o igual a 0'),
  body('costPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Precio de costo debe ser mayor o igual a 0'),
  body('minStock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock mínimo debe ser mayor o igual a 0'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Ubicación no puede exceder 100 caracteres'),
  body('supplier')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Proveedor no puede exceder 200 caracteres'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser true o false')
];

const stockMovementValidation = [
  body('type')
    .notEmpty()
    .withMessage('Tipo de movimiento es obligatorio')
    .isIn(['entrada', 'salida', 'ajuste'])
    .withMessage('Tipo de movimiento inválido'),
  body('quantity')
    .notEmpty()
    .withMessage('Cantidad es obligatoria')
    .isInt({ min: 1 })
    .withMessage('Cantidad debe ser mayor a 0'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Razón no puede exceder 200 caracteres'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notas no pueden exceder 500 caracteres')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de producto inválido')
];

const barcodeValidation = [
  param('barcode')
    .trim()
    .notEmpty()
    .withMessage('Código de barras es obligatorio')
];

const listValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit debe estar entre 1 y 100'),
  query('lowStock')
    .optional()
    .isBoolean()
    .withMessage('lowStock debe ser true o false'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser true o false')
];

// Rutas especiales (antes de las rutas con :id)
router.get('/products/alerts/low-stock', getLowStockProducts);
router.get('/products/barcode/:barcode', barcodeValidation, validate, getProductByBarcode);
router.get('/stats', getInventoryStats);
router.get('/export', exportInventory);

// Rutas de productos
router.get('/products', listValidation, validate, listProducts);
router.get('/products/:id', idValidation, validate, getProduct);
router.post('/products', createProductValidation, validate, createProduct);
router.put('/products/:id', idValidation, updateProductValidation, validate, updateProduct);
router.delete('/products/:id', idValidation, validate, deleteProduct);
router.put('/products/:id/restore', idValidation, validate, restoreProduct);

// Rutas de movimientos de stock
router.post('/products/:id/movements', idValidation, stockMovementValidation, validate, addStockMovement);
router.get('/products/:id/movements', idValidation, validate, getStockMovements);

module.exports = router;