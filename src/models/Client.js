const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Nombre es obligatorio'],
    trim: true,
    maxlength: [100, 'Nombre no puede exceder 100 caracteres']
  },
  lastName1: {
    type: String,
    required: [true, 'Apellido paterno es obligatorio'],
    trim: true,
    maxlength: [100, 'Apellido paterno no puede exceder 100 caracteres']
  },
  lastName2: {
    type: String,
    trim: true,
    maxlength: [100, 'Apellido materno no puede exceder 100 caracteres']
  },
  phone: {
    type: String,
    required: [true, 'Teléfono es obligatorio'],
    minlength: [9, 'Teléfono debe tener al menos 9 caracteres'],
    maxlength: [20, 'Teléfono no puede exceder 20 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email no válido']
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
clientSchema.index({ email: 1 });
clientSchema.index({ firstName: 1, lastName1: 1 });
clientSchema.index({ isDeleted: 1, createdAt: -1 });

// Método para obtener nombre completo
clientSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName1} ${this.lastName2 || ''}`.trim();
};

// Validar si se puede eliminar
clientSchema.methods.canDelete = async function() {
  const Quote = mongoose.model('Quote');
  const WorkOrder = mongoose.model('WorkOrder');
  
  // Verificar si tiene presupuestos aprobados
  const hasApprovedQuotes = await Quote.exists({ 
    clientId: this._id, 
    status: 'approved',
    isDeleted: false 
  });
  
  if (hasApprovedQuotes) {
    return { canDelete: false, reason: 'Cliente tiene presupuestos aprobados' };
  }
  
  // Verificar si tiene órdenes activas (no entregadas)
  const hasActiveOrders = await WorkOrder.exists({
    'quote.clientId': this._id,
    status: { $nin: ['entregado'] },
    isDeleted: false
  });
  
  if (hasActiveOrders) {
    return { canDelete: false, reason: 'Cliente tiene órdenes de trabajo activas' };
  }
  
  return { canDelete: true };
};

// Método para soft delete
clientSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Obtener estadísticas del cliente
clientSchema.methods.getStats = async function() {
  const Quote = mongoose.model('Quote');
  const WorkOrder = mongoose.model('WorkOrder');
  
  const quotes = await Quote.find({ clientId: this._id, isDeleted: false });
  const orders = await WorkOrder.find({ quoteId: { $in: quotes.map(q => q._id) }, isDeleted: false });
  
  const totalSpent = orders
    .filter(o => o.status === 'entregado' && o.finalCost)
    .reduce((sum, o) => sum + o.finalCost, 0);
  
  return {
    totalQuotes: quotes.length,
    approvedQuotes: quotes.filter(q => q.status === 'approved').length,
    totalOrders: orders.length,
    completedOrders: orders.filter(o => o.status === 'entregado').length,
    totalSpent
  };
};

// Ocultar datos de eliminación si no está eliminado
clientSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  }
});

module.exports = mongoose.model('Client', clientSchema);