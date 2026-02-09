const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Información del vehículo
  patente: {
    type: String,
    required: [true, 'La patente es obligatoria'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  marca: {
    type: String,
    required: [true, 'La marca es obligatoria'],
    trim: true
  },
  modelo: {
    type: String,
    required: [true, 'El modelo es obligatorio'],
    trim: true
  },
  año: {
    type: Number,
    required: [true, 'El año es obligatorio'],
    min: 1900,
    max: new Date().getFullYear() + 1
  },
  color: {
    type: String,
    trim: true
  },
  vin: {
    type: String,
    trim: true,
    uppercase: true
  },
  motor: {
    type: String,
    trim: true
  },
  combustible: {
    type: String,
    enum: ['gasolina', 'diesel', 'gas', 'electrico', 'híbrido', 'otro'],
    default: 'gasolina'
  },
  transmision: {
    type: String,
    enum: ['manual', 'automatica', 'otro'],
    default: 'manual'
  },

  // Relación con cliente
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },

  // Kilometraje
  kilometraje: {
    type: Number,
    default: 0
  },
  ultimoKilometraje: {
    type: Number,
    default: 0
  },
  fechaUltimoKilometraje: {
    type: Date
  },

  // Historial de kilometrajes
  historialKilometraje: [{
    kilometraje: Number,
    fecha: {
      type: Date,
      default: Date.now
    },
    observaciones: String,
    registradoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Observaciones y notas
  observaciones: {
    type: String,
    trim: true
  },

  // Estado
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices compuestos
vehicleSchema.index({ cliente: 1, isDeleted: 1 });
vehicleSchema.index({ patente: 1, isDeleted: 1 });

// Virtual para nombre completo del vehículo
vehicleSchema.virtual('nombreCompleto').get(function() {
  return `${this.marca} ${this.modelo} ${this.año} - ${this.patente}`;
});

// Método para soft delete
vehicleSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Método para restaurar
vehicleSchema.methods.restore = function() {
  this.isDeleted = false;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

// Método para actualizar kilometraje
vehicleSchema.methods.actualizarKilometraje = function(nuevoKm, observaciones, userId) {
  // Guardar en historial
  this.historialKilometraje.push({
    kilometraje: nuevoKm,
    fecha: new Date(),
    observaciones,
    registradoPor: userId
  });

  // Actualizar kilometraje actual
  this.ultimoKilometraje = this.kilometraje;
  this.kilometraje = nuevoKm;
  this.fechaUltimoKilometraje = new Date();

  return this.save();
};

// Configurar toJSON para incluir virtuals
vehicleSchema.set('toJSON', { virtuals: true });
vehicleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);