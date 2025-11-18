const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientHistory
} = require('../controllers/clientController');

// Todas las rutas requieren autenticación y rol admin
router.use(authenticate, authorize('admin'));

// Validaciones
const createClientValidation = [
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
    .withMessage('Teléfono debe tener entre 9 y 20 caracteres'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email es obligatorio')
    .isEmail()
    .withMessage('Email no válido')
    .normalizeEmail()
];

const updateClientValidation = [
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
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Email no válido')
    .normalizeEmail()
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de cliente inválido')
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
  query('includeDeleted')
    .optional()
    .isBoolean()
    .withMessage('includeDeleted debe ser true o false')
];

// Rutas
router.get('/', listValidation, validate, listClients);
router.get('/:id', idValidation, validate, getClient);
router.post('/', createClientValidation, validate, createClient);
router.put('/:id', idValidation, updateClientValidation, validate, updateClient);
router.delete('/:id', idValidation, validate, deleteClient);
router.get('/:id/history', idValidation, validate, getClientHistory);

module.exports = router;