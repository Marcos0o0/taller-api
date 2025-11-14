const mongoose = require('mongoose');

const mechanicSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Usuario es obligatorio'],
    unique: true
  },
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
  isActive: {
    type: Boolean,
    default: true
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
mechanicSchema.index({ userId: 1 });
mechanicSchema.index({ isActive: 1, isDeleted: 1 });

// Método para obtener nombre completo
mechanicSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName1} ${this.lastName2 || ''}`.trim();
};

// Obtener estadísticas del mecánico
mechanicSchema.methods.getStats = async function() {
  const WorkOrder = mongoose.model('WorkOrder');
  
  const orders = await WorkOrder.find({ 
    mechanicId: this._id, 
    isDeleted: false 
  });
  
  const activeOrders = orders.filter(o => 
    ['asignada', 'en_progreso', 'listo'].includes(o.status)
  ).length;
  
  const completedOrders = orders.filter(o => 
    o.status === 'entregado'
  ).length;
  
  // Calcular tiempo promedio de completado
  const completedWithTime = orders.filter(o => 
    o.status === 'entregado' && o.actualDelivery
  );
  
  let avgCompletionTime = 0;
  if (completedWithTime.length > 0) {
    const totalTime = completedWithTime.reduce((sum, o) => {
      const time = o.getRepairTime();
      return sum + (time ? time.totalHours : 0);
    }, 0);
    
    avgCompletionTime = (totalTime / completedWithTime.length / 24).toFixed(1);
  }
  
  return {
    activeOrders,
    completedOrders,
    avgCompletionTime: `${avgCompletionTime} días`
  };
};

// Validar si se puede eliminar
mechanicSchema.methods.canDelete = async function() {
  const WorkOrder = mongoose.model('WorkOrder');
  
  const hasActiveOrders = await WorkOrder.exists({
    mechanicId: this._id,
    status: { $nin: ['entregado'] },
    isDeleted: false
  });
  
  if (hasActiveOrders) {
    return { 
      canDelete: false, 
      reason: 'Mecánico tiene órdenes de trabajo activas' 
    };
  }
  
  return { canDelete: true };
};

// Método para soft delete
mechanicSchema.methods.softDelete = async function(deletedBy) {
  const validation = await this.canDelete();
  
  if (!validation.canDelete) {
    throw new Error(validation.reason);
  }
  
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Populate automático del usuario en queries
mechanicSchema.pre(/^find/, function(next) {
  if (!this.getOptions().skipPopulate) {
    this.populate('userId', 'username role');
  }
  next();
});

// Ocultar datos de eliminación si no está eliminado
mechanicSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  }
});

module.exports = mongoose.model('Mechanic', mechanicSchema);