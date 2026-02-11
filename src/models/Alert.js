// models/Alert.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const alertSchema = new Schema({
  tipo: {
    type: String,
    enum: [
      'stock_bajo',
      'stock_critico',
      'stock_agotado',
      'precio_cambio',
      'movimiento_inusual',
      'expiracion_cercana',
      'devolucion_pendiente',
    ],
    required: true,
    index: true,
  },

  severidad: {
    type: String,
    enum: ['baja', 'media', 'alta', 'critica'],
    default: 'media',
    index: true,
  },

  // ✅ Cambiado ref de 'Part' a 'Product' para que coincida con el modelo real
  repuesto: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },

  titulo: {
    type: String,
    required: true,
  },
  mensaje: {
    type: String,
    required: true,
  },

  datos: {
    stockActual: Number,
    stockMinimo: Number,
    stockMaximo: Number,
    precioAnterior: Number,
    precioNuevo: Number,
    diferencia: Number,
    fechaExpiracion: Date,
    diasRestantes: Number,
  },

  estado: {
    type: String,
    enum: ['activa', 'vista', 'resuelta', 'descartada'],
    default: 'activa',
    index: true,
  },

  acciones: [{
    tipo: String,
    descripcion: String,
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    fecha: {
      type: Date,
      default: Date.now,
    },
  }],

  notificaciones: [{
    tipo: String,
    destinatario: String,
    enviada: {
      type: Boolean,
      default: false,
    },
    fecha: Date,
    error: String,
  }],

  resueltoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  fechaResolucion: Date,
  notasResolucion: String,

  autoResuelta: {
    type: Boolean,
    default: false,
  },

  fechaCreacion: {
    type: Date,
    default: Date.now,
    index: true,
  },
  fechaExpiracion: {
    type: Date,
    index: true,
  },

}, { timestamps: true });

// Índices compuestos
alertSchema.index({ tipo: 1, estado: 1, severidad: -1 });
alertSchema.index({ repuesto: 1, estado: 1 });
alertSchema.index({ estado: 1, fechaCreacion: -1 });

// ✅ Marcar como vista
alertSchema.methods.marcarVista = async function(userId) {
  this.estado = 'vista';
  this.acciones.push({
    tipo: 'visto',
    descripcion: 'Alerta vista',
    usuario: userId,
  });
  return await this.save();
};

// ✅ Resolver alerta
alertSchema.methods.resolver = async function(userId, notas) {
  this.estado = 'resuelta';
  this.resueltoPor = userId;
  this.fechaResolucion = new Date();
  this.notasResolucion = notas;
  this.acciones.push({
    tipo: 'resuelto',
    descripcion: notas || 'Alerta resuelta',
    usuario: userId,
  });
  return await this.save();
};

// ✅ Registrar notificación enviada
alertSchema.methods.registrarNotificacion = function(tipo, destinatario, exito, error) {
  this.notificaciones.push({
    tipo,
    destinatario,
    enviada: exito,
    fecha: new Date(),
    error: error || undefined,
  });
  return this.save();
};

module.exports = mongoose.model('Alert', alertSchema);