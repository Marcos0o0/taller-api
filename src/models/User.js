const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username es obligatorio'],
    unique: true,
    trim: true,
    minlength: [3, 'Username debe tener al menos 3 caracteres'],
    maxlength: [50, 'Username no puede exceder 50 caracteres']
  },
  password: {
    type: String,
    required: [true, 'Password es obligatorio'],
    minlength: [6, 'Password debe tener al menos 6 caracteres']
  },
  role: {
    type: String,
    enum: ['admin', 'mechanic'],
    default: 'mechanic'
  },
  refreshToken: {
    type: String,
    default: null
  },
  tokenExpiration: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { 
  timestamps: true 
});

// Índices
userSchema.index({ username: 1 });
userSchema.index({ role: 1, isDeleted: 1 });

// Hash password antes de guardar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Método para verificar password
userSchema.methods.verifyPassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Método para verificar si está bloqueado
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Incrementar intentos de login fallidos
userSchema.methods.incLoginAttempts = async function() {
  // Si ya pasó el tiempo de bloqueo, resetear
  if (this.lockUntil && this.lockUntil < Date.now()) {
    await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
    return;
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Bloquear después de 5 intentos por 15 minutos
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 15 * 60 * 1000 };
  }
  
  await this.updateOne(updates);
};

// Resetear intentos de login
userSchema.methods.resetLoginAttempts = async function() {
  await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// No retornar password y refreshToken en JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.tokenExpiration;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    if (ret.isDeleted) {
      delete ret.deletedBy;
    }
    return ret;
  }
});

// Método para soft delete
userSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);