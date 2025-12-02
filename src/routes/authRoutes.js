const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const { authLimiter } = require('../middlewares/rateLimiter');
const {
  register,
  login,
  refresh,
  logout,
  getMe
} = require('../controllers/authController');

// Validaciones
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('El username debe tener entre 3 y 50 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('El username solo puede contener letras, números y guiones bajos'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'mechanic'])
    .withMessage('Rol inválido')
];

const loginValidation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('El username es obligatorio'),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria')
];

const refreshValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('El refresh token es obligatorio')
];

// Rutas
router.post('/register', 
  authenticate, 
  authorize('admin'), 
  registerValidation, 
  validate, 
  register
);

router.post('/login', 
  authLimiter, 
  loginValidation, 
  validate, 
  login
);

router.post('/refresh', 
  refreshValidation, 
  validate, 
  refresh
);

router.post('/logout', 
  authenticate, 
  logout
);

router.get('/me', 
  authenticate, 
  getMe
);

module.exports = router;