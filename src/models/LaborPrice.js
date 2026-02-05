// models/laborPrice.model.js

const mongoose = require('mongoose');

const laborPriceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del servicio es obligatorio'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'La descripción es obligatoria'],
      trim: true,
    },
    estimatedTime: {
      type: String,
      required: [true, 'El tiempo estimado es obligatorio'],
      trim: true,
      // Ej: "1-2 horas", "30-45 min"
    },
    priceRange: {
      min: {
        type: Number,
        required: [true, 'El precio mínimo es obligatorio'],
        min: [0, 'El precio no puede ser negativo'],
      },
      max: {
        type: Number,
        required: [true, 'El precio máximo es obligatorio'],
        min: [0, 'El precio no puede ser negativo'],
        validate: {
          validator: function (value) {
            return value >= this.priceRange.min;
          },
          message: 'El precio máximo debe ser mayor o igual al mínimo',
        },
      },
    },
    difficulty: {
      type: String,
      required: [true, 'La dificultad es obligatoria'],
      enum: {
        values: ['Básico', 'Intermedio', 'Avanzado', 'Especializado'],
        message: '{VALUE} no es una dificultad válida',
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceCategory',
      required: [true, 'La categoría es obligatoria'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Índices para búsqueda
laborPriceSchema.index({ name: 'text', description: 'text' });
laborPriceSchema.index({ categoryId: 1 });
laborPriceSchema.index({ difficulty: 1 });

// Virtual para calcular precio promedio
laborPriceSchema.virtual('averagePrice').get(function () {
  return (this.priceRange.min + this.priceRange.max) / 2;
});

const LaborPrice = mongoose.model('LaborPrice', laborPriceSchema);

// ==========================================
// Modelo de Categoría
// ==========================================

const serviceCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre de la categoría es obligatorio'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
      // Puedes guardar el nombre del icono de Ant Design
      // Ej: "SettingOutlined", "CarOutlined", etc.
    },
    color: {
      type: String,
      required: [true, 'El color es obligatorio'],
      trim: true,
      // Ej: "#ff4d4f", "#1890ff", etc.
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual para obtener servicios de la categoría
serviceCategorySchema.virtual('services', {
  ref: 'LaborPrice',
  localField: '_id',
  foreignField: 'categoryId',
});

serviceCategorySchema.index({ order: 1 });

const ServiceCategory = mongoose.model('ServiceCategory', serviceCategorySchema);

module.exports = { LaborPrice, ServiceCategory };