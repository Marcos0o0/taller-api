const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listOrders,
  getOrder,
  updateOrder,
  updateOrderStatus,
  assignMechanic,
  deleteOrder
} = require('../controllers/orderController');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Validaciones
const updateOrderValidation = [
  body('additionalNotes')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Notas adicionales no pueden exceder 2000 caracteres'),
  body('additionalWork')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Trabajos adicionales no pueden exceder 2000 caracteres'),
  body('finalCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Costo final debe ser mayor o igual a 0'),
  body('estimatedDelivery')
    .optional()
    .isISO8601()
    .withMessage('Fecha estimada de entrega inválida')
];

const updateStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Estado es obligatorio')
    .isIn(['pendiente_asignacion', 'asignada', 'en_progreso', 'listo', 'entregado'])
    .withMessage('Estado inválido'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notas no pueden exceder 500 caracteres')
];

const assignMechanicValidation = [
  body('mechanicId')
    .notEmpty()
    .withMessage('ID de mecánico es obligatorio')
    .isMongoId()
    .withMessage('ID de mecánico inválido')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de orden inválido')
];

// Rutas
router.get('/', listOrders);
router.get('/:id', idValidation, validate, getOrder);
router.put('/:id', idValidation, updateOrderValidation, validate, updateOrder);
router.put('/:id/status', idValidation, updateStatusValidation, validate, updateOrderStatus);
router.put('/:id/assign', authorize('admin'), idValidation, assignMechanicValidation, validate, assignMechanic);
router.delete('/:id', authorize('admin'), idValidation, validate, deleteOrder);

module.exports = router;