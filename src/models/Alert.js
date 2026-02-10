// models/Alert.model.js
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
  
  // Referencia al repuesto
  repuesto: {
    type: Schema.Types.ObjectId,
    ref: 'Part',
    required: true,
  },
  
  // Mensaje de la alerta
  titulo: {
    type: String,
    required: true,
  },
  mensaje: {
    type: String,
    required: true,
  },
  
  // Datos contextuales
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
  
  // Estado de la alerta
  estado: {
    type: String,
    enum: ['activa', 'vista', 'resuelta', 'descartada'],
    default: 'activa',
    index: true,
  },
  
  // Acciones tomadas
  acciones: [{
    tipo: String, // 'visto', 'resuelto', 'pedido_realizado', 'stock_ajustado'
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
  
  // Notificaciones enviadas
  notificaciones: [{
    tipo: String, // 'email', 'sms', 'push', 'websocket'
    destinatario: String,
    enviada: {
      type: Boolean,
      default: false,
    },
    fecha: Date,
    error: String,
  }],
  
  // Resolución
  resueltoPor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  fechaResolucion: Date,
  notasResolucion: String,
  
  // Auto-resolución (opcional)
  autoResuelta: {
    type: Boolean,
    default: false,
  },
  
  // Metadata
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

// ✅ Método para marcar como vista
alertSchema.methods.marcarVista = async function(userId) {
  this.estado = 'vista';
  this.acciones.push({
    tipo: 'visto',
    descripcion: 'Alerta vista',
    usuario: userId,
  });
  return await this.save();
};

// ✅ Método para resolver alerta
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

// ✅ Método para registrar notificación enviada
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

// ✅ Método estático para crear alerta de stock bajo
alertSchema.statics.crearAlertaStockBajo = async function(repuesto) {
  const { stock, nombre, codigo } = repuesto;
  
  // Verificar si ya existe alerta activa para este repuesto
  const existente = await this.findOne({
    repuesto: repuesto._id,
    tipo: 'stock_bajo',
    estado: 'activa',
  });
  
  if (existente) {
    // Actualizar datos si cambió el stock
    existente.datos.stockActual = stock.cantidad;
    return await existente.save();
  }
  
  // Determinar severidad
  let severidad = 'media';
  const porcentaje = (stock.cantidad / stock.minimo) * 100;
  
  if (stock.cantidad === 0) {
    severidad = 'critica';
  } else if (porcentaje < 25) {
    severidad = 'alta';
  } else if (porcentaje < 50) {
    severidad = 'media';
  }
  
  // Crear nueva alerta
  return await this.create({
    tipo: stock.cantidad === 0 ? 'stock_agotado' : 'stock_bajo',
    severidad,
    repuesto: repuesto._id,
    titulo: stock.cantidad === 0 
      ? `⚠️ Stock agotado: ${nombre}` 
      : `🔻 Stock bajo: ${nombre}`,
    mensaje: stock.cantidad === 0
      ? `El repuesto ${codigo} (${nombre}) está completamente agotado.`
      : `El repuesto ${codigo} (${nombre}) tiene stock bajo. Quedan ${stock.cantidad} unidades de un mínimo de ${stock.minimo}.`,
    datos: {
      stockActual: stock.cantidad,
      stockMinimo: stock.minimo,
      stockMaximo: stock.maximo,
    },
    fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
  });
};

module.exports = mongoose.model('Alert', alertSchema);