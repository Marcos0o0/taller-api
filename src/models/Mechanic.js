const mongoose = require("mongoose");

const mechanicSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Usuario es obligatorio"],
      unique: true,
    },
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
      minlength: [9, "Teléfono debe tener al menos 9 caracteres"],
      maxlength: [20, "Teléfono no puede exceder 20 caracteres"],
    },
    isActive: {
      type: Boolean,
      default: true,
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
mechanicSchema.index({ userId: 1 });
mechanicSchema.index({ isActive: 1, isDeleted: 1 });

// Método para obtener nombre completo
mechanicSchema.methods.getFullName = function () {
  return `${this.firstName} ${this.lastName1} ${this.lastName2 || ""}`.trim();
};

// Obtener estadísticas del mecánico
mechanicSchema.methods.getStats = async function () {
  const Quote = mongoose.model("Quote");

  const quotes = await Quote.find({
    "workOrder.mechanicId": this._id,
    isDeleted: false,
  });

  const activeOrders = quotes.filter(
    (q) =>
      q.workOrder &&
      ["asignada", "en_progreso", "listo"].includes(q.workOrder.status)
  ).length;

  const completedOrders = quotes.filter(
    (q) => q.workOrder && q.workOrder.status === "entregado"
  ).length;

  // Calcular tiempo promedio de completado
  const completedWithTime = quotes.filter(
    (q) =>
      q.workOrder &&
      q.workOrder.status === "entregado" &&
      q.workOrder.actualDelivery &&
      q.workOrder.createdAt
  );

  let avgCompletionTime = 0;
  if (completedWithTime.length > 0) {
    const totalTime = completedWithTime.reduce((sum, q) => {
      const diffMs =
        new Date(q.workOrder.actualDelivery) - new Date(q.workOrder.createdAt);
      const diffHours = diffMs / (1000 * 60 * 60);
      return sum + diffHours;
    }, 0);

    avgCompletionTime = (totalTime / completedWithTime.length / 24).toFixed(1);
  }

  return {
    activeOrders,
    completedOrders,
    avgCompletionTime: `${avgCompletionTime} días`,
  };
};

// Validar si se puede eliminar
mechanicSchema.methods.canDelete = async function () {
  const Quote = mongoose.model("Quote");

  const hasActiveOrders = await Quote.exists({
    "workOrder.mechanicId": this._id,
    "workOrder.status": { $nin: ["entregado"] },
    isDeleted: false,
  });

  if (hasActiveOrders) {
    return {
      canDelete: false,
      reason: "Mecánico tiene órdenes de trabajo activas",
    };
  }

  return { canDelete: true };
};

// Método para soft delete
mechanicSchema.methods.softDelete = async function (deletedBy) {
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
mechanicSchema.pre(/^find/, function (next) {
  if (!this.getOptions().skipPopulate) {
    this.populate("userId", "username role");
  }
  next();
});

// Ocultar datos de eliminación si no está eliminado
mechanicSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  },
});

module.exports = mongoose.model("Mechanic", mechanicSchema);
