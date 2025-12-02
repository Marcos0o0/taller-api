const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { publicLimiter } = require('../middlewares/rateLimiter');
const {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  sendQuoteEmail,
  approveQuote,
  rejectQuote,
  approveQuoteManual,
  rejectQuoteManual
} = require('../controllers/quoteController');

// Rutas públicas (con token de aprobación)
router.get('/:id/approve', publicLimiter, approveQuote);
router.get('/:id/reject', publicLimiter, rejectQuote);

// Validaciones
const createQuoteValidation = [
  body('clientId')
    .notEmpty()
    .withMessage('Cliente es obligatorio')
    .isMongoId()
    .withMessage('ID de cliente inválido'),
  body('vehicle.brand')
    .trim()
    .notEmpty()
    .withMessage('Marca del vehículo es obligatoria'),
  body('vehicle.model')
    .trim()
    .notEmpty()
    .withMessage('Modelo del vehículo es obligatorio'),
  body('vehicle.year')
    .isInt({ min: 1950, max: new Date().getFullYear() + 1 })
    .withMessage('Año del vehículo inválido'),
  body('vehicle.licensePlate')
    .trim()
    .notEmpty()
    .withMessage('Patente es obligatoria'),
  body('vehicle.mileage')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Kilometraje debe ser mayor o igual a 0'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Descripción debe tener entre 20 y 2000 caracteres'),
  body('proposedWork')
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Trabajo propuesto debe tener entre 20 y 2000 caracteres'),
  body('estimatedCost')
    .isFloat({ min: 0 })
    .withMessage('Costo estimado debe ser mayor o igual a 0'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notas no pueden exceder 1000 caracteres')
];

const updateQuoteValidation = [
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Descripción debe tener entre 20 y 2000 caracteres'),
  body('proposedWork')
    .optional()
    .trim()
    .isLength({ min: 20, max: 2000 })
    .withMessage('Trabajo propuesto debe tener entre 20 y 2000 caracteres'),
  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Costo estimado debe ser mayor o igual a 0'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notas no pueden exceder 1000 caracteres')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de presupuesto inválido')
];

// Rutas protegidas - Admin
router.use(authenticate, authorize('admin'));

router.get('/', listQuotes);
router.get('/:id', idValidation, validate, getQuote);
router.post('/', createQuoteValidation, validate, createQuote);
router.put('/:id', idValidation, updateQuoteValidation, validate, updateQuote);
router.post('/:id/send-email', idValidation, validate, sendQuoteEmail);
router.put('/:id/approve', idValidation, validate, approveQuoteManual);
router.put('/:id/reject', idValidation, validate, rejectQuoteManual);

module.exports = router;