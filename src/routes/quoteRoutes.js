const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { publicLimiter } = require('../middlewares/rateLimiter');
const controller = require('../controllers/quoteController');
const router = express.Router();

router.get('/:id/approve', publicLimiter, controller.approveQuote);
router.get('/:id/reject', publicLimiter, controller.rejectQuote);
router.use(authenticate, authorize('admin'));

const idValidation = [param('id').isMongoId().withMessage('ID de presupuesto inválido')];
const quoteValidation = [
  body('clientId').optional().isMongoId().withMessage('Seleccione un cliente válido'),
  body('vehicle').optional({ nullable: true }).isObject(),
  body('vehicle.brand').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('vehicle.model').optional({ checkFalsy: true }).isString().trim().isLength({ max: 100 }),
  body('vehicle.year')
    .optional({ nullable: true })
    .isInt({ min: 1950, max: new Date().getFullYear() + 1 }),
  body('vehicle.licensePlate')
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .isLength({ max: 20 }),
  body('vehicle.mileage').optional({ nullable: true }).isInt({ min: 0 }),
  body('vehicleId').optional({ nullable: true }).isMongoId(),
  body('description').optional().isString().trim().isLength({ max: 2000 }),
  body('proposedWork').optional().isString().isLength({ max: 500000 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  body('includeIVA').optional().isBoolean(),
  body('estimatedCost').optional().isInt({ min: 0 }),
  body('items').optional().isArray({ min: 1, max: 500 }),
  body('abonos').optional().isArray({ max: 500 }),
  body('abonos.*.amount').isInt({ min: 1 }),
  body('abonos.*.notes').optional().isString().isLength({ max: 500 }),
  body('abonos.*.date').optional().isISO8601(),
  body('validUntil').optional().isISO8601(),
];
const requestValidation = [
  body('requestId').optional().isUUID().withMessage('Identificador de guardado inválido'),
];

router.get('/', query('trash').optional().isBoolean(), validate, controller.listQuotes);
router.get('/:id/history', idValidation, validate, controller.getQuoteHistory);
router.get('/:id', idValidation, validate, controller.getQuote);
router.post(
  '/',
  quoteValidation,
  body('clientId').notEmpty().isMongoId(),
  requestValidation,
  validate,
  controller.createQuote
);
router.put(
  '/:id',
  idValidation,
  quoteValidation,
  body('expectedVersion').isInt({ min: 0 }),
  validate,
  controller.updateQuote
);
router.post('/:id/duplicate', idValidation, requestValidation, validate, controller.duplicateQuote);
router.post('/:id/restore', idValidation, validate, controller.restoreQuote);
router.post('/:id/send-email', idValidation, validate, controller.sendQuoteEmail);
router.put('/:id/approve', idValidation, validate, controller.approveQuoteManual);
router.put('/:id/reject', idValidation, validate, controller.rejectQuoteManual);
router.delete('/:id', idValidation, validate, controller.deleteQuote);
router.post(
  '/:id/abonos',
  idValidation,
  body('amount').isInt({ min: 1 }),
  body('notes').optional().isString().isLength({ max: 500 }),
  validate,
  controller.addAbono
);
router.delete(
  '/:id/abonos/:abonoIndex',
  idValidation,
  param('abonoIndex').isInt({ min: 0 }),
  validate,
  controller.removeAbono
);

module.exports = router;
