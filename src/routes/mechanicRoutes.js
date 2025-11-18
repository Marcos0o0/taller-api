const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listMechanics,
  getMechanic,
  createMechanic,
  updateMechanic,
  getMechanicOrders
} = require('../controllers/mechanicController');

// Todas las rutas requieren admin
router.use(authenticate, authorize('admin'));

// Validaciones
const createMechanicValidation = [
  body('userId')
    .notEmpty()
    .withMessage('ID de usuario es obligatorio')
    .isMongoId()
    .withMessage('ID de usuario inválido'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Nombre es obligatorio')
    .isLength({ max: 100 })
    .withMessage('Nombre no puede exceder 100 caracteres'),
  body('lastName1')
    .trim()
    .notEmpty()
    .withMessage('Apellido paterno es obligatorio')
    .isLength({ max: 100 })
    .withMessage('Apellido paterno no puede exceder 100 caracteres'),
  body('lastName2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Apellido materno no puede exceder 100 caracteres'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Teléfono es obligatorio')
    .isLength({ min: 9, max: 20 })
    .withMessage('Teléfono debe tener entre 9 y 20 caracteres')
];

const updateMechanicValidation = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Nombre no puede estar vacío')
    .isLength({ max: 100 })
    .withMessage('Nombre no puede exceder 100 caracteres'),
  body('lastName1')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Apellido paterno no puede estar vacío')
    .isLength({ max: 100 })
    .withMessage('Apellido paterno no puede exceder 100 caracteres'),
  body('lastName2')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Apellido materno no puede exceder 100 caracteres'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 9, max: 20 })
    .withMessage('Teléfono debe tener entre 9 y 20 caracteres'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser true o false')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de mecánico inválido')
];

// Rutas
router.get('/', listMechanics);
router.get('/:id', idValidation, validate, getMechanic);
router.post('/', createMechanicValidation, validate, createMechanic);
router.put('/:id', idValidation, updateMechanicValidation, validate, updateMechanic);
router.get('/:id/orders', idValidation, validate, getMechanicOrders);

module.exports = router;