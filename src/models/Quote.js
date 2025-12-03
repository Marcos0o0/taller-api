const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const vehicleSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      required: [true, "Marca es obligatoria"],
      trim: true,
      maxlength: [100, "Marca no puede exceder 100 caracteres"],
    },
    model: {
      type: String,
      required: [true, "Modelo es obligatorio"],
      trim: true,
      maxlength: [100, "Modelo no puede exceder 100 caracteres"],
    },
    year: {
      type: Number,
      required: [true, "Año es obligatorio"],
      min: [1950, "Año debe ser mayor a 1950"],
      max: [
        new Date().getFullYear() + 1,
        "Año no puede ser mayor al próximo año",
      ],
    },
    licensePlate: {
      type: String,
      required: [true, "Patente es obligatoria"],
      trim: true,
      uppercase: true,
      maxlength: [20, "Patente no puede exceder 20 caracteres"],
    },
    mileage: {
      type: Number,
      min: [0, "Kilometraje no puede ser negativo"],
      default: 0,
    },
  },
  { _id: false }
);

const approvalTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
    },
    type: {
      type: String,
      enum: ["approve", "reject"],
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { _id: false }
);

// SUBDOCUMENTO: Status History
const statusHistorySchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      enum: [
        "pendiente_asignacion",
        "asignada",
        "en_progreso",
        "listo",
        "entregado",
      ],
    },
    newStatus: {
      type: String,
      enum: [
        "pendiente_asignacion",
        "asignada",
        "en_progreso",
        "listo",
        "entregado",
      ],
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      maxlength: [500, "Notas no pueden exceder 500 caracteres"],
    },
  },
  { _id: false }
);

// SUBDOCUMENTO: Notification
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["orden_creada", "asignada", "listo", "entregado"],
      required: true,
    },
    method: {
      type: String,
      enum: ["email"],
      default: "email",
    },
    status: {
      type: String,
      enum: ["pendiente", "enviado", "fallido"],
      default: "pendiente",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  },
  { _id: false }
);

// SUBDOCUMENTO: WorkOrder (ahora embebido en Quote)
const workOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
    },
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mechanic",
    },
    workDescription: {
      type: String,
      required: [true, "Descripción del trabajo es obligatoria"],
    },
    estimatedCost: {
      type: Number,
      required: [true, "Costo estimado es obligatorio"],
      min: [0, "Costo estimado no puede ser negativo"],
    },
    finalCost: {
      type: Number,
      min: [0, "Costo final no puede ser negativo"],
    },
    status: {
      type: String,
      enum: [
        "pendiente_asignacion",
        "asignada",
        "en_progreso",
        "listo",
        "entregado",
      ],
      default: "pendiente_asignacion",
    },
    statusHistory: [statusHistorySchema],
    estimatedDelivery: {
      type: Date,
    },
    actualDelivery: {
      type: Date,
    },
    additionalNotes: {
      type: String,
      maxlength: [2000, "Notas adicionales no pueden exceder 2000 caracteres"],
    },
    additionalWork: {
      type: String,
      maxlength: [
        2000,
        "Trabajos adicionales no pueden exceder 2000 caracteres",
      ],
    },
    notifications: [notificationSchema],
    readyEmailSent: {
      type: Boolean,
      default: false,
    },
    readyEmailSentAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// DOCUMENTO PRINCIPAL: Quote
const quoteSchema = new mongoose.Schema(
  {
    quoteNumber: {
      type: String,
      unique: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Cliente es obligatorio"],
    },
    vehicle: {
      type: vehicleSchema,
      required: [true, "Datos del vehículo son obligatorios"],
    },
    description: {
      type: String,
      required: [true, "Descripción es obligatoria"],
      minlength: [20, "Descripción debe tener al menos 20 caracteres"],
      maxlength: [2000, "Descripción no puede exceder 2000 caracteres"],
    },
    proposedWork: {
      type: String,
      required: [true, "Trabajo propuesto es obligatorio"],
      minlength: [20, "Trabajo propuesto debe tener al menos 20 caracteres"],
      maxlength: [2000, "Trabajo propuesto no puede exceder 2000 caracteres"],
    },
    estimatedCost: {
      type: Number,
      required: [true, "Costo estimado es obligatorio"],
      min: [0, "Costo debe ser mayor o igual a 0"],
    },
    validUntil: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvalTokens: [approvalTokenSchema],
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
    emailAttempts: {
      type: Number,
      default: 0,
    },
    // WorkOrder ahora es un subdocumento
    workOrder: {
      type: workOrderSchema,
      default: null,
    },
    notes: {
      type: String,
      maxlength: [1000, "Notas no pueden exceder 1000 caracteres"],
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
quoteSchema.index({ quoteNumber: 1 });
quoteSchema.index({ clientId: 1, status: 1, createdAt: -1 });
quoteSchema.index({ status: 1, createdAt: -1 });
quoteSchema.index({ "approvalTokens.token": 1 });
quoteSchema.index({ "vehicle.licensePlate": 1, isDeleted: 1 });
quoteSchema.index({ "workOrder.orderNumber": 1 });
quoteSchema.index({ "workOrder.mechanicId": 1, "workOrder.status": 1 });
quoteSchema.index({ "workOrder.status": 1, createdAt: -1 });

// Generar número de presupuesto automáticamente
quoteSchema.pre("save", async function (next) {
  if (!this.quoteNumber) {
    const count = await mongoose.model("Quote").countDocuments();
    this.quoteNumber = `PRES-${String(count + 1).padStart(4, "0")}`;
  }

  // Actualizar updatedAt del workOrder si existe
  if (this.workOrder && this.isModified("workOrder")) {
    this.workOrder.updatedAt = new Date();
  }

  next();
});

// Método para generar tokens de aprobación
quoteSchema.methods.generateTokens = function () {
  const approveToken = uuidv4();
  const rejectToken = uuidv4();

  this.approvalTokens = [
    {
      token: approveToken,
      type: "approve",
      used: false,
    },
    {
      token: rejectToken,
      type: "reject",
      used: false,
    },
  ];

  return { approveToken, rejectToken };
};

// Método para validar token
quoteSchema.methods.validateToken = function (token) {
  const tokenObj = this.approvalTokens.find((t) => t.token === token);

  if (!tokenObj) {
    return { valid: false, error: "Token inválido" };
  }

  if (tokenObj.used) {
    return { valid: false, error: "Token ya fue utilizado" };
  }

  if (this.validUntil < new Date()) {
    return { valid: false, error: "Token expirado" };
  }

  if (this.status !== "pending") {
    return { valid: false, error: "Presupuesto ya fue procesado" };
  }

  return { valid: true, type: tokenObj.type, tokenObj };
};

// Método para usar token
quoteSchema.methods.useToken = async function (token, ipAddress, userAgent) {
  const tokenObj = this.approvalTokens.find((t) => t.token === token);

  if (tokenObj) {
    tokenObj.used = true;
    tokenObj.usedAt = new Date();
    tokenObj.ipAddress = ipAddress;
    tokenObj.userAgent = userAgent;

    // Invalidar todos los demás tokens
    this.approvalTokens.forEach((t) => {
      if (t.token !== token) {
        t.used = true;
        t.usedAt = new Date();
      }
    });

    await this.save();
  }
};

// Validar si se puede editar
quoteSchema.methods.canEdit = function () {
  return this.status === "pending" && !this.isDeleted && !this.workOrder;
};

// Validar si se puede eliminar
quoteSchema.methods.canDelete = function () {
  return this.status === "pending" && !this.workOrder && !this.isDeleted;
};

// Método para soft delete
quoteSchema.methods.softDelete = async function (deletedBy) {
  if (!this.canDelete()) {
    throw new Error("No se puede eliminar este presupuesto");
  }

  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  await this.save();
};

// ==========================================
// MÉTODOS PARA WORKORDER (subdocumento)
// ==========================================

// Crear orden de trabajo al aprobar presupuesto
quoteSchema.methods.createWorkOrder = async function () {
  if (this.workOrder) {
    throw new Error("Este presupuesto ya tiene una orden de trabajo");
  }

  if (this.status !== "approved") {
    throw new Error("El presupuesto debe estar aprobado para crear una orden");
  }

  // Generar número de orden
  const allQuotes = await mongoose
    .model("Quote")
    .find({ workOrder: { $exists: true, $ne: null } });
  const orderCount = allQuotes.length;
  const orderNumber = `ORD-${String(orderCount + 1).padStart(4, "0")}`;

  this.workOrder = {
    orderNumber,
    workDescription: `${this.description}\n\nTrabajo propuesto:\n${this.proposedWork}`,
    estimatedCost: this.estimatedCost,
    status: "pendiente_asignacion",
    statusHistory: [],
    notifications: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await this.save();
  return this.workOrder;
};

// Validar transición de estado del workOrder
quoteSchema.methods.validateWorkOrderStatusTransition = function (newStatus) {
  if (!this.workOrder) {
    return { valid: false, error: "No existe orden de trabajo" };
  }

  const transitions = {
    pendiente_asignacion: ["asignada"],
    asignada: ["en_progreso", "pendiente_asignacion"],
    en_progreso: ["listo", "asignada"],
    listo: ["entregado", "en_progreso"],
    entregado: [], // Estado final
  };

  const validTransitions = transitions[this.workOrder.status] || [];

  if (!validTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `No se puede cambiar de "${this.workOrder.status}" a "${newStatus}"`,
    };
  }

  // Validar que tenga mecánico asignado antes de pasar a en_progreso
  if (newStatus === "en_progreso" && !this.workOrder.mechanicId) {
    return {
      valid: false,
      error: "Debe asignar un mecánico antes de iniciar el trabajo",
    };
  }

  return { valid: true };
};

// Cambiar estado del workOrder
quoteSchema.methods.changeWorkOrderStatus = async function (
  newStatus,
  changedBy,
  notes = ""
) {
  const validation = this.validateWorkOrderStatusTransition(newStatus);

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const previousStatus = this.workOrder.status;
  this.workOrder.status = newStatus;

  // Agregar al historial
  this.workOrder.statusHistory.push({
    previousStatus,
    newStatus,
    changedBy,
    changedAt: new Date(),
    notes,
  });

  // Si cambia a entregado, registrar fecha
  if (newStatus === "entregado") {
    this.workOrder.actualDelivery = new Date();
  }

  this.workOrder.updatedAt = new Date();
  await this.save();

  return this;
};

// Asignar mecánico
quoteSchema.methods.assignMechanic = async function (mechanicId, assignedBy) {
  if (!this.workOrder) {
    throw new Error("No existe orden de trabajo");
  }

  this.workOrder.mechanicId = mechanicId;

  // Si está en pendiente_asignacion, cambiar a asignada
  if (this.workOrder.status === "pendiente_asignacion") {
    await this.changeWorkOrderStatus(
      "asignada",
      assignedBy,
      "Mecánico asignado"
    );
  } else {
    this.workOrder.updatedAt = new Date();
    await this.save();
  }

  return this;
};

// Actualizar información del workOrder
quoteSchema.methods.updateWorkOrder = async function (updates) {
  if (!this.workOrder) {
    throw new Error("No existe orden de trabajo");
  }

  const { additionalNotes, additionalWork, finalCost, estimatedDelivery } =
    updates;

  if (additionalNotes !== undefined)
    this.workOrder.additionalNotes = additionalNotes;
  if (additionalWork !== undefined)
    this.workOrder.additionalWork = additionalWork;
  if (finalCost !== undefined) this.workOrder.finalCost = finalCost;
  if (estimatedDelivery !== undefined)
    this.workOrder.estimatedDelivery = estimatedDelivery;

  this.workOrder.updatedAt = new Date();
  await this.save();

  return this;
};

// Calcular tiempo de reparación
quoteSchema.methods.getWorkOrderRepairTime = function () {
  if (!this.workOrder || !this.workOrder.actualDelivery) return null;

  const start = this.workOrder.createdAt;
  const end = this.workOrder.actualDelivery;
  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );

  return {
    days: diffDays,
    hours: diffHours,
    totalHours: Math.floor(diffMs / (1000 * 60 * 60)),
  };
};

// Validar si se puede eliminar el workOrder
quoteSchema.methods.canDeleteWorkOrder = function () {
  return this.workOrder && this.workOrder.status === "pendiente_asignacion";
};

// Populate automático del cliente en queries
quoteSchema.pre(/^find/, function (next) {
  if (!this.getOptions().skipPopulate) {
    this.populate(
      "clientId",
      "firstName lastName1 lastName2 email phone"
    ).populate("workOrder.mechanicId");
  }
  next();
});

// Hook post-save para enviar notificación cuando workOrder cambia a "listo"
quoteSchema.post("save", async function (doc, next) {
  if (
    doc.workOrder &&
    doc.workOrder.status === "listo" &&
    !doc.workOrder.readyEmailSent
  ) {
    try {
      const emailService = require("../services/emailService");
      await emailService.sendReadyNotification(doc);

      doc.workOrder.readyEmailSent = true;
      doc.workOrder.readyEmailSentAt = new Date();

      // Agregar notificación al historial
      doc.workOrder.notifications.push({
        type: "listo",
        method: "email",
        status: "enviado",
        attempts: 1,
        sentAt: new Date(),
      });

      await doc.save();
    } catch (error) {
      console.error("Error enviando notificación:", error);

      // Registrar fallo
      doc.workOrder.notifications.push({
        type: "listo",
        method: "email",
        status: "fallido",
        attempts: 1,
        error: error.message,
      });

      await doc.save();
    }
  }
  next();
});

// Ocultar tokens en JSON (seguridad)
quoteSchema.set("toJSON", {
  transform: (doc, ret) => {
    if (ret.approvalTokens) {
      ret.approvalTokens = ret.approvalTokens.map((t) => ({
        type: t.type,
        used: t.used,
        usedAt: t.usedAt,
      }));
    }
    if (!ret.isDeleted) {
      delete ret.deletedAt;
      delete ret.deletedBy;
    }
    return ret;
  },
});

module.exports = mongoose.model("Quote", quoteSchema);
