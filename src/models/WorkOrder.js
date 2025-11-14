const mongoose = require('mongoose');

const vehicleSnapshotSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  year: { type: Number, required: true },
  licensePlate: { type: String, required: true },
  mileage: { type: Number, default: 0 }
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  previousStatus: {
    type: String,
    enum: ['pendiente_asignacion', 'asignada', 'en_progreso', 'listo', 'entregado']
  },
  newStatus: {
    type: String,
    enum: ['pendiente_asignacion', 'asignada', 'en_progreso', 'listo', 'entregado'],
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    maxlength: [500, 'Notas no pueden exceder 500 caracteres']
  }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['orden_creada', 'asignada', 'listo', 'entregado'],
    required: true
  },
  method: {
    type: String,
    enum: ['email'],
    default: 'email'
  },
  status: {
    type: String,
    enum: ['pendiente', 'enviado', 'fallido'],
    default: 'pendiente'
  },
  attempts: {
    type: Number,
    default: 0
  },
  sentAt: {
    type: Date
  },
  error: {
    type: String
  }
}, { _id: false });

const workOrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  quoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    required: [true, 'Presupuesto es obligatorio'],
    unique: true
  },
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic'
  },
  vehicleSnapshot: {
    type: vehicleSnapshotSchema,
    required: [true, 'Datos del vehículo son obligatorios']
  },
  workDescription: {
    type: String,
    required: [true, 'Descripción del trabajo es obligatoria']
  },
  estimatedCost: {
    type: Number,
    required: [true, 'Costo estimado es obligatorio'],
    min: [0, 'Costo estimado no puede ser negativo']
  },
  finalCost: {
    type: Number,
    min: [0, 'Costo final no puede ser negativo']
  },
  status: {
    type: String,
    enum: ['pendiente_asignacion', 'asignada', 'en_progreso', 'listo', 'entregado'],
    default: 'pendiente_asignacion'
  },
  statusHistory: [statusHistorySchema],
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  additionalNotes: {
    type: String,
    maxlength: [2000, 'Notas adicionales no pueden exceder 2000 caracteres']
  },
  additionalWork: {
    type: String,
    maxlength: [2000, 'Trabajos adicionales no pueden exceder 2000 caracteres']
  },
  notifications: [notificationSchema],
  readyEmailSent: {
    type: Boolean,
    default: false
  },
  readyEmailSentAt: {
    type: Date
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
workOrderSchema.index({ orderNumber: 1 });
workOrderSchema.index({ quoteId: 1 });
workOrderSchema.index({ mechanicId: 1, status: 1, createdAt: -1 });
workOrderSchema.index({ status: 1, createdAt: -1 });
workOrderSchema.index({ 'vehicleSnapshot.licensePlate': 1, isDeleted: 1 });

// Generar número de orden automáticamente
workOrderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('WorkOrder').countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;
  }
  
  next();
});

// Validar transiciones de estado
workOrderSchema.methods.validateStatusTransition = function(newStatus) {
  const transitions = {
    'pendiente_asignacion': ['asignada'],
    'asignada': ['en_progreso', 'pendiente_asignacion'],
    'en_progreso': ['listo', 'asignada'],
    'listo': ['entregado', 'en_progreso'],
    'entregado': [] // Estado final
  };
  
  const validTransitions = transitions[this.status] || [];
  
  if (!validTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `No se puede cambiar de "${this.status}" a "${newStatus}"`
    };
  }
  
  // Validar que tenga mecánico asignado antes de pasar a en_progreso
  if (newStatus === 'en_progreso' && !this.mechanicId) {
    return {
      valid: false,
      error: 'Debe asignar un mecánico antes de iniciar el trabajo'
    };
  }
  
  return { valid: true };
};

// Cambiar estado y registrar en historial
workOrderSchema.methods.changeStatus = async function(newStatus, changedBy, notes = '') {
  const validation = this.validateStatusTransition(newStatus);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const previousStatus = this.status;
  this.status = newStatus;
  
  // Agregar al historial
  this.statusHistory.push({
    previousStatus,
    newStatus,
    changedBy,
    changedAt: new Date(),
    notes
  });
  
  // Si cambia a entregado, registrar fecha
  if (newStatus === 'entregado') {
    this.actualDelivery = new Date();
  }
  
  await this.save();
  
  // Si cambia a listo, enviar notificación (se maneja en el hook post-save)
  return this;
};

// Hook para enviar notificación automática al cambiar a "listo"
workOrderSchema.post('save', async function(doc, next) {
  if (doc.status === 'listo' && !doc.readyEmailSent) {
    try {
      const emailService = require('../services/emailService');
      await emailService.sendReadyNotification(doc);
      
      doc.readyEmailSent = true;
      doc.readyEmailSentAt = new Date();
      
      // Agregar notificación al historial
      doc.notifications.push({
        type: 'listo',
        method: 'email',
        status: 'enviado',
        attempts: 1,
        sentAt: new Date()
      });
      
      await doc.save();
    } catch (error) {
      console.error('Error enviando notificación:', error);
      
      // Registrar fallo
      doc.notifications.push({
        type: 'listo',
        method: 'email',
        status: 'fallido',
        attempts: 1,
        error: error.message
      });
      
      await doc.save();
    }
  }
  next();
});

// Validar si se puede eliminar
workOrderSchema.methods.canDelete = function() {
  return this.status === 'pendiente_asignacion' && !this.isDeleted;
};

// Método para soft delete
workOrderSchema.methods.softDelete = async function(deletedBy) {
  if (!this.canDelete()) {
    throw new Error('Solo se pueden eliminar órdenes en estado pendiente de asignación');
  }
  
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Calcular tiempo de reparación
workOrderSchema.methods.getRepairTime = function() {
  if (!this.actualDelivery) return null;
  
  const start = this.createdAt;
  const end = this.actualDelivery;
  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return {
    days: diffDays,
    hours: diffHours,
    totalHours: Math.floor(diffMs / (1000 * 60 * 60))
  };
};

// Populate automático en queries
workOrderSchema.pre(/^find/, function(next) {
  if (!this.getOptions().skipPopulate) {
    this.populate('quoteId')
        .populate('mechanicId');
  }
  next();
});

// Ocultar datos sensibles en JSON
workOrderSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  }
});

module.exports = mongoose.model('WorkOrder', workOrderSchema);