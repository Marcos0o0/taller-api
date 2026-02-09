const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listVehicles,
  getVehicle,
  getVehicleByPatente,
  getVehiclesByCliente,
  createVehicle,
  updateVehicle,
  updateKilometraje,
  deleteVehicle,
  restoreVehicle,
  getKilometrajeHistorial
} = require('../controllers/vehicleController');

// Validaciones
const createVehicleValidation = [
  body('patente')
    .trim()
    .notEmpty()
    .withMessage('La patente es obligatoria')
    .isLength({ min: 6, max: 7 })
    .withMessage('La patente debe tener 6 o 7 caracteres'),
  body('marca')
    .trim()
    .notEmpty()
    .withMessage('La marca es obligatoria'),
  body('modelo')
    .trim()
    .notEmpty()
    .withMessage('El modelo es obligatorio'),
  body('año')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Año inválido'),
  body('cliente')
    .notEmpty()
    .withMessage('El cliente es obligatorio')
    .isMongoId()
    .withMessage('ID de cliente inválido'),
  body('combustible')
    .optional()
    .isIn(['gasolina', 'diesel', 'gas', 'electrico', 'híbrido', 'otro'])
    .withMessage('Tipo de combustible inválido'),
  body('transmision')
    .optional()
    .isIn(['manual', 'automatica', 'otro'])
    .withMessage('Tipo de transmisión inválido'),
  body('kilometraje')
    .optional()
    .isInt({ min: 0 })
    .withMessage('El kilometraje debe ser un número positivo')
];

const updateVehicleValidation = [
  body('marca')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La marca no puede estar vacía'),
  body('modelo')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El modelo no puede estar vacío'),
  body('año')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Año inválido'),
  body('combustible')
    .optional()
    .isIn(['gasolina', 'diesel', 'gas', 'electrico', 'híbrido', 'otro'])
    .withMessage('Tipo de combustible inválido'),
  body('transmision')
    .optional()
    .isIn(['manual', 'automatica', 'otro'])
    .withMessage('Tipo de transmisión inválido')
];

const updateKilometrajeValidation = [
  body('kilometraje')
    .isInt({ min: 0 })
    .withMessage('El kilometraje debe ser un número positivo'),
  body('observaciones')
    .optional()
    .trim()
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID inválido')
];

// Rutas públicas (requieren autenticación básica)
router.use(authenticate);

// Listar vehículos
router.get('/', listVehicles);

// Buscar por patente
router.get('/patente/:patente', getVehicleByPatente);

// Buscar por cliente
router.get('/cliente/:clienteId', 
  param('clienteId').isMongoId().withMessage('ID de cliente inválido'),
  validate,
  getVehiclesByCliente
);

// Obtener vehículo por ID
router.get('/:id', 
  mongoIdValidation,
  validate,
  getVehicle
);

// Obtener historial de kilometraje
router.get('/:id/historial-kilometraje',
  mongoIdValidation,
  validate,
  getKilometrajeHistorial
);

// Crear vehículo
router.post('/',
  createVehicleValidation,
  validate,
  createVehicle
);

// Actualizar vehículo
router.put('/:id',
  mongoIdValidation,
  updateVehicleValidation,
  validate,
  updateVehicle
);

// Actualizar kilometraje
router.put('/:id/kilometraje',
  mongoIdValidation,
  updateKilometrajeValidation,
  validate,
  updateKilometraje
);

// Restaurar vehículo (solo admin)
router.put('/:id/restore',
  authorize('admin'),
  mongoIdValidation,
  validate,
  restoreVehicle
);

// Eliminar vehículo (solo admin)
router.delete('/:id',
  authorize('admin'),
  mongoIdValidation,
  validate,
  deleteVehicle
);

module.exports = router;