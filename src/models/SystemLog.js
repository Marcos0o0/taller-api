const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error'],
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    index: true,
    maxlength: [100, 'Acción no puede exceder 100 caracteres']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  module: {
    type: String,
    required: true,
    enum: ['auth', 'users', 'clients', 'quotes', 'orders', 'mechanics', 'email', 'system'],
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    maxlength: [45, 'IP Address no puede exceder 45 caracteres']
  },
  userAgent: {
    type: String,
    maxlength: [500, 'User Agent no puede exceder 500 caracteres']
  },
  requestId: {
    type: String,
    index: true
  }
}, {
  timestamps: false
});

// Índices compuestos
systemLogSchema.index({ timestamp: -1, level: 1 });
systemLogSchema.index({ userId: 1, timestamp: -1 });
systemLogSchema.index({ action: 1, timestamp: -1 });

// Método estático para crear log
systemLogSchema.statics.createLog = async function({
  level,
  action,
  userId = null,
  module,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  requestId = null
}) {
  try {
    const log = new this({
      level,
      action,
      userId,
      module,
      metadata,
      ipAddress,
      userAgent,
      requestId
    });
    
    await log.save();
    return log;
  } catch (error) {
    console.error('Error creating system log:', error);
    return null;
  }
};

// Método estático para buscar logs
systemLogSchema.statics.findLogs = async function(filters = {}, options = {}) {
  const query = {};
  
  if (filters.level) {
    query.level = filters.level;
  }
  
  if (filters.action) {
    query.action = filters.action;
  }
  
  if (filters.userId) {
    query.userId = filters.userId;
  }
  
  if (filters.module) {
    query.module = filters.module;
  }
  
  if (filters.startDate || filters.endDate) {
    query.timestamp = {};
    if (filters.startDate) {
      query.timestamp.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.timestamp.$lte = new Date(filters.endDate);
    }
  }
  
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;
  const sort = options.sort || '-timestamp';
  
  const [logs, total] = await Promise.all([
    this.find(query)
        .populate('userId', 'username role')
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// No modificar logs existentes
systemLogSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Los logs del sistema no pueden ser modificados'));
});

systemLogSchema.pre('updateOne', function(next) {
  next(new Error('Los logs del sistema no pueden ser modificados'));
});

systemLogSchema.pre('updateMany', function(next) {
  next(new Error('Los logs del sistema no pueden ser modificados'));
});

module.exports = mongoose.model('SystemLog', systemLogSchema);