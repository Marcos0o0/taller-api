const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const validate = require('../middlewares/validator');
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  toggleUserStatus,
  deleteUser
} = require('../controllers/userController');

// Todas las rutas requieren admin
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

// Rutas
router.get('/', listUsers);
router.get('/:id', idValidation, validate, getUser);
router.post('/', createUserValidation, validate, createUser);
router.put('/:id', idValidation, updateUserValidation, validate, updateUser);
router.put('/:id/password', idValidation, changePasswordValidation, validate, changePassword);
router.put('/:id/toggle-status', idValidation, validate, toggleUserStatus);
router.delete('/:id', idValidation, validate, deleteUser);

module.exports = router;