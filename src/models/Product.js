const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['entrada', 'salida', 'ajuste'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    maxlength: [200, 'La razón no puede exceder 200 caracteres']
  },
  notes: {
    type: String,
    maxlength: [500, 'Las notas no pueden exceder 500 caracteres']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const productSchema = new mongoose.Schema({
  barcode: {
    type: String,
    required: [true, 'Código de barras es obligatorio'],
    unique: true,
    trim: true,
    maxlength: [50, 'Código de barras no puede exceder 50 caracteres']
  },
  name: {
    type: String,
    required: [true, 'Nombre es obligatorio'],
    trim: true,
    maxlength: [200, 'Nombre no puede exceder 200 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Descripción no puede exceder 1000 caracteres']
  },
  category: {
    type: String,
    required: [true, 'Categoría es obligatoria'],
    trim: true,
    maxlength: [100, 'Categoría no puede exceder 100 caracteres']
  },
  price: {
    type: Number,
    required: [true, 'Precio es obligatorio'],
    min: [0, 'Precio no puede ser negativo']
  },
  costPrice: {
    type: Number,
    min: [0, 'Precio de costo no puede ser negativo']
  },
  stock: {
    type: Number,
    required: [true, 'Stock es obligatorio'],
    min: [0, 'Stock no puede ser negativo'],
    default: 0
  },
  minStock: {
    type: Number,
    required: [true, 'Stock mínimo es obligatorio'],
    min: [0, 'Stock mínimo no puede ser negativo'],
    default: 0
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Ubicación no puede exceder 100 caracteres']
  },
  supplier: {
    type: String,
    trim: true,
    maxlength: [200, 'Proveedor no puede exceder 200 caracteres']
  },
  // 🔥 NUEVO: Campo para especificaciones técnicas
  specifications: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // 🔥 NUEVO: Campo para imagen del producto
  imageUrl: {
    type: String,
    trim: true,
    maxlength: [5000000, 'Imagen demasiado grande'] // ~5MB en base64
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
  },
  stockMovements: [stockMovementSchema]
}, {
  timestamps: true
});

// Índices
productSchema.index({ barcode: 1 });
productSchema.index({ name: 1 });
productSchema.index({ category: 1, isDeleted: 1 });
productSchema.index({ isActive: 1, isDeleted: 1 });
productSchema.index({ stock: 1, minStock: 1 });

// Índice único para código de barras solo cuando no está eliminado
productSchema.index(
  { barcode: 1, isDeleted: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);

// Validación personalizada para código de barras único
productSchema.pre('save', async function(next) {
  if (this.isModified('barcode') && !this.isDeleted) {
    const existingProduct = await mongoose.model('Product').findOne({
      barcode: this.barcode,
      isDeleted: false,
      _id: { $ne: this._id }
    });
    
    if (existingProduct) {
      const error = new Error('Ya existe un producto con ese código de barras');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Método para verificar si el stock está bajo
productSchema.methods.isLowStock = function() {
  return this.stock <= this.minStock;
};

// Método para agregar movimiento de stock
productSchema.methods.addStockMovement = async function(movement, userId) {
  const { type, quantity, reason, notes } = movement;

  // Validar cantidad
  if (type === 'salida' && this.stock < quantity) {
    throw new Error('Stock insuficiente para realizar la salida');
  }

  // Actualizar stock
  switch (type) {
    case 'entrada':
      this.stock += quantity;
      break;
    case 'salida':
      this.stock -= quantity;
      break;
    case 'ajuste':
      this.stock = quantity;
      break;
  }

  // Agregar movimiento al historial
  this.stockMovements.push({
    type,
    quantity,
    reason,
    notes,
    userId,
    createdAt: new Date()
  });

  await this.save();
  return this.stockMovements[this.stockMovements.length - 1];
};

// Método para soft delete
productSchema.methods.softDelete = async function(deletedBy) {
  this.isDeleted = true;
  this.isActive = false;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Método para restaurar
productSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  await this.save();
};

// Ocultar datos de eliminación si no está eliminado
productSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);