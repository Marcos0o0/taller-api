const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Nombre es obligatorio"],
      trim: true,
      maxlength: [100, "Nombre no puede exceder 100 caracteres"],
    },
    lastName1: {
      type: String,
      required: [true, "Apellido paterno es obligatorio"],
      trim: true,
      maxlength: [100, "Apellido paterno no puede exceder 100 caracteres"],
    },
    lastName2: {
      type: String,
      trim: true,
      maxlength: [100, "Apellido materno no puede exceder 100 caracteres"],
    },
    phone: {
      type: String,
      required: [true, "Teléfono es obligatorio"],
      trim: true,
      minlength: [9, "Teléfono debe tener al menos 9 caracteres"],
      maxlength: [20, "Teléfono no puede exceder 20 caracteres"],
      validate: {
        validator: function(v) {
          return /^[+]?[\d\s-()]+$/.test(v);
        },
        message: "Teléfono debe contener solo números, espacios, guiones y paréntesis"
      }
    },
    email: {
      type: String,
      required: [true, "Email es obligatorio"],
      unique: true,
      trim: true,
      // IMPORTANTE: Removí lowercase aquí para preservar el formato original
      // El email se normalizará en el setter personalizado
      set: function(email) {
        // Normalizar el email: trim y lowercase, pero SIN eliminar puntos
        if (!email) return email;
        return email.trim().toLowerCase();
      },
      validate: {
        validator: function(v) {
          // Validación más estricta de email
          return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: "Email no válido"
      }
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices
clientSchema.index({ email: 1 });
clientSchema.index({ firstName: 1, lastName1: 1 });
clientSchema.index({ isDeleted: 1, createdAt: -1 });
clientSchema.index({ phone: 1 });

// Índice único compuesto para email solo cuando no está eliminado
clientSchema.index(
  { email: 1, isDeleted: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDeleted: false }
  }
);

// Validación personalizada para email único considerando soft delete
clientSchema.pre('save', async function(next) {
  if (this.isModified('email') && !this.isDeleted) {
    const existingClient = await mongoose.model('Client').findOne({
      email: this.email,
      isDeleted: false,
      _id: { $ne: this._id }
    });
    
    if (existingClient) {
      const error = new Error('Ya existe un cliente con ese email');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Método para obtener nombre completo
clientSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName1} ${this.lastName2 || ""}`.trim();
};

// Validar si se puede eliminar
clientSchema.methods.canDelete = async function () {
  const Quote = mongoose.model("Quote");

  // Verificar si tiene presupuestos aprobados
  const hasApprovedQuotes = await Quote.exists({
    clientId: this._id,
    status: "approved",
    isDeleted: false,
  });

  if (hasApprovedQuotes) {
    return { canDelete: false, reason: "Cliente tiene presupuestos aprobados" };
  }

  // Verificar si tiene órdenes activas (no entregadas)
  const hasActiveOrders = await Quote.exists({
    clientId: this._id,
    "workOrder.status": {
      $in: ["pendiente_asignacion", "asignada", "en_progreso", "listo"],
    },
    isDeleted: false,
  });

  if (hasActiveOrders) {
    return {
      canDelete: false,
      reason: "Cliente tiene órdenes de trabajo activas",
    };
  }

  return { canDelete: true };
};

// Método para soft delete
clientSchema.methods.softDelete = async function (deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// Obtener estadísticas del cliente
clientSchema.methods.getStats = async function () {
  const Quote = mongoose.model("Quote");

  const quotes = await Quote.find({ clientId: this._id, isDeleted: false });

  const ordersWithFinalCost = quotes.filter(
    (q) =>
      q.workOrder && q.workOrder.status === "entregado" && q.workOrder.finalCost
  );

  const totalSpent = ordersWithFinalCost.reduce(
    (sum, q) => sum + q.workOrder.finalCost,
    0
  );

  return {
    totalQuotes: quotes.length,
    approvedQuotes: quotes.filter((q) => q.status === "approved").length,
    totalOrders: quotes.filter((q) => q.workOrder).length,
    completedOrders: quotes.filter(
      (q) => q.workOrder && q.workOrder.status === "entregado"
    ).length,
    totalSpent,
  };
};

// Ocultar datos de eliminación si no está eliminado
clientSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  },
});

module.exports = mongoose.model("Client", clientSchema);