const express = require('express');
const { randomBytes, createHash } = require('crypto');
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { asyncHandler } = require('../middlewares/errorHandler');
const Device = require('../models/Device');
const router = express.Router();

router.use(authenticate, authorize('admin'));
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const devices = await Device.find({ userId: req.userId }).sort('-createdAt');
    res.json({ success: true, data: { devices } });
  })
);

router.post(
  '/',
  body('name').trim().isLength({ min: 1, max: 100 }),
  validate,
  asyncHandler(async (req, res) => {
    // Solo las credenciales del propietario pueden vincular otro equipo.
    if (req.headers.authorization.startsWith('Bearer device_')) {
      return res
        .status(403)
        .json({
          success: false,
          error: {
            code: 'OWNER_REQUIRED',
            message: 'Usa las credenciales del propietario para vincular otro equipo.',
          },
        });
    }
    const token = `device_${randomBytes(32).toString('hex')}`;
    const device = await Device.create({
      name: req.body.name,
      userId: req.userId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
    });
    res
      .status(201)
      .json({ success: true, data: { device: { _id: device._id, name: device.name }, token } });
  })
);

router.delete(
  '/:id',
  param('id').isMongoId(),
  validate,
  asyncHandler(async (req, res) => {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { revokedAt: new Date() } }
    );
    if (!device)
      return res
        .status(404)
        .json({
          success: false,
          error: { code: 'DEVICE_NOT_FOUND', message: 'Equipo no encontrado.' },
        });
    res.json({ success: true, message: 'Acceso del equipo revocado.' });
  })
);

module.exports = router;
