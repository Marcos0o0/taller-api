const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { getLogs } = require('../controllers/logController');

// Solo admin puede ver logs
router.use(authenticate, authorize('admin'));

const logsValidation = [
  query('level')
    .optional()
    .isIn(['info', 'warn', 'error'])
    .withMessage('Nivel de log inválido'),
  query('module')
    .optional()
    .isIn(['auth', 'users', 'clients', 'quotes', 'orders', 'mechanics', 'email', 'system'])
    .withMessage('Módulo inválido'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser mayor a 0'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit debe estar entre 1 y 100')
];

router.get('/', logsValidation, validate, getLogs);

module.exports = router;