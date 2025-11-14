const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const vehicleSchema = new mongoose.Schema({
  brand: { 
    type: String, 
    required: [true, 'Marca es obligatoria'],
    trim: true,
    maxlength: [100, 'Marca no puede exceder 100 caracteres']
  },
  model: { 
    type: String, 
    required: [true, 'Modelo es obligatorio'],
    trim: true,
    maxlength: [100, 'Modelo no puede exceder 100 caracteres']
  },
  year: { 
    type: Number, 
    required: [true, 'Año es obligatorio'],
    min: [1950, 'Año debe ser mayor a 1950'],
    max: [new Date().getFullYear() + 1, 'Año no puede ser mayor al próximo año']
  },
  licensePlate: { 
    type: String, 
    required: [true, 'Patente es obligatoria'],
    trim: true,
    uppercase: true,
    maxlength: [20, 'Patente no puede exceder 20 caracteres']
  },
  mileage: { 
    type: Number, 
    min: [0, 'Kilometraje no puede ser negativo'],
    default: 0
  }
}, { _id: false });

const approvalTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    sparse: true
  },
  type: {
    type: String,
    enum: ['approve', 'reject'],
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: {
    type: Date
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    unique: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Cliente es obligatorio']
  },
  vehicle: {
    type: vehicleSchema,
    required: [true, 'Datos del vehículo son obligatorios']
  },
  description: {
    type: String,
    required: [true, 'Descripción es obligatoria'],
    minlength: [20, 'Descripción debe tener al menos 20 caracteres'],
    maxlength: [2000, 'Descripción no puede exceder 2000 caracteres']
  },
  proposedWork: {
    type: String,
    required: [true, 'Trabajo propuesto es obligatorio'],
    minlength: [20, 'Trabajo propuesto debe tener al menos 20 caracteres'],
    maxlength: [2000, 'Trabajo propuesto no puede exceder 2000 caracteres']
  },
  estimatedCost: {
    type: Number,
    required: [true, 'Costo estimado es obligatorio'],
    min: [0, 'Costo debe ser mayor o igual a 0']
  },
  validUntil: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvalTokens: [approvalTokenSchema],
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date
  },
  emailAttempts: {
    type: Number,
    default: 0
  },
  workOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkOrder'
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notas no pueden exceder 1000 caracteres']
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
quoteSchema.index({ quoteNumber: 1 });
quoteSchema.index({ clientId: 1, status: 1, createdAt: -1 });
quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ 'approvalTokens.token': 1 });
quoteSchema.index({ 'vehicle.licensePlate': 1, isDeleted: 1 });

// Generar número de presupuesto automáticamente
quoteSchema.pre('save', async function(next) {
  if (!this.quoteNumber) {
    const count = await mongoose.model('Quote').countDocuments();
    this.quoteNumber = `PRES-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Método para generar tokens de aprobación
quoteSchema.methods.generateTokens = function() {
  const approveToken = uuidv4();
  const rejectToken = uuidv4();
  
  this.approvalTokens = [
    {
      token: approveToken,
      type: 'approve',
      used: false
    },
    {
      token: rejectToken,
      type: 'reject',
      used: false
    }
  ];
  
  return { approveToken, rejectToken };
};

// Método para validar token
quoteSchema.methods.validateToken = function(token) {
  const tokenObj = this.approvalTokens.find(t => t.token === token);
  
  if (!tokenObj) {
    return { valid: false, error: 'Token inválido' };
  }
  
  if (tokenObj.used) {
    return { valid: false, error: 'Token ya fue utilizado' };
  }
  
  if (this.validUntil < new Date()) {
    return { valid: false, error: 'Token expirado' };
  }
  
  if (this.status !== 'pending') {
    return { valid: false, error: 'Presupuesto ya fue procesado' };
  }
  
  return { valid: true, type: tokenObj.type, tokenObj };
};

// Método para usar token
quoteSchema.methods.useToken = async function(token, ipAddress, userAgent) {
  const tokenObj = this.approvalTokens.find(t => t.token === token);
  
  if (tokenObj) {
    tokenObj.used = true;
    tokenObj.usedAt = new Date();
    tokenObj.ipAddress = ipAddress;
    tokenObj.userAgent = userAgent;
    
    // Invalidar todos los demás tokens
    this.approvalTokens.forEach(t => {
      if (t.token !== token) {
        t.used = true;
        t.usedAt = new Date();
      }
    });
    
    await this.save();
  }
};

// Validar si se puede editar
quoteSchema.methods.canEdit = function() {
  return this.status === 'pending' && !this.isDeleted;
};

// Validar si se puede eliminar
quoteSchema.methods.canDelete = function() {
  return this.status === 'pending' && !this.workOrderId && !this.isDeleted;
};

// Método para soft delete
quoteSchema.methods.softDelete = async function(deletedBy) {
  if (!this.canDelete()) {
    throw new Error('No se puede eliminar este presupuesto');
  }
  
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Populate automático del cliente en queries
quoteSchema.pre(/^find/, function(next) {
  if (!this.getOptions().skipPopulate) {
    this.populate('clientId', 'firstName lastName1 lastName2 email phone');
  }
  next();
});

// Ocultar tokens en JSON (seguridad)
quoteSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.approvalTokens) {
      ret.approvalTokens = ret.approvalTokens.map(t => ({
        type: t.type,
        used: t.used,
        usedAt: t.usedAt
      }));
    }
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  }
});

module.exports = mongoose.model('Quote', quoteSchema);