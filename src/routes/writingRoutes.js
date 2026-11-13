const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');
const { correctWriting } = require('../services/writingService');

router.use(authenticate, authorize('admin'));
router.post('/correct',
  rateLimit({ windowMs: 60000, max: 30, keyGenerator: req => String(req.userId), standardHeaders: true, legacyHeaders: false }),
  body('text').isString().trim().isLength({ min: 3, max: 500 }).not().matches(/[\r\n]/),
  validate,
  asyncHandler(async (req, res) => res.json({ success: true, data: await correctWriting(req.body.text) }))
);
module.exports = router;
