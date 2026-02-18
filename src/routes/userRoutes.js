const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const User = require('../models/User');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  toggleUserStatus,
  deleteUser
} = require('../controllers/userController');

// ✅ NUEVA RUTA: Guardar token FCM (cualquier usuario autenticado)
// IMPORTANTE: Va ANTES del middleware authorize('admin')
router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.id || req.user._id;

    if (!fcmToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token FCM requerido' 
      });
    }

    await User.findByIdAndUpdate(userId, { fcmToken });

    console.log(`✅ Token FCM guardado para usuario: ${req.user.username}`);

    res.json({ 
      success: true, 
      message: 'Token FCM guardado correctamente' 
    });

  } catch (error) {
    console.error('❌ Error guardando token FCM:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Todas las rutas de abajo requieren admin
router.use(authenticate, authorize('admin'));

// Validaciones
const createUserValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username solo puede contener letras, números y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password debe tener al menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'mechanic'])
    .withMessage('Rol inválido')
];

const updateUserValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username solo puede contener letras, números y guiones bajos'),
  body('role')
    .optional()
    .isIn(['admin', 'mechanic'])
    .withMessage('Rol inválido')
];

const changePasswordValidation = [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nueva contraseña debe tener al menos 6 caracteres')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de usuario inválido')
];

// Rutas admin
router.get('/', listUsers);
router.get('/:id', idValidation, validate, getUser);
router.post('/', createUserValidation, validate, createUser);
router.put('/:id', idValidation, updateUserValidation, validate, updateUser);
router.put('/:id/password', idValidation, changePasswordValidation, validate, changePassword);
router.put('/:id/toggle-status', idValidation, validate, toggleUserStatus);
router.delete('/:id', idValidation, validate, deleteUser);

module.exports = router;