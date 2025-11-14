const winston = require('winston');
const path = require('path');

// Definir formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Formato para consola (más legible)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, action, ...meta }) => {
    let log = `${timestamp} [${level}]`;
    
    if (module) log += ` [${module}]`;
    if (action) log += ` [${action}]`;
    log += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { service: 'taller-api' },
  transports: [
    // Escribir todos los logs en combined.log
    new winston.transports.File({ 
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Escribir errores en error.log
    new winston.transports.File({ 
      filename: path.join('logs', 'error.log'), 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Si no estamos en producción, también log a consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Wrapper para facilitar logging estructurado
const structuredLog = (level, message, options = {}) => {
  const { module, action, metadata, userId, ipAddress, userAgent, requestId } = options;
  
  logger.log({
    level,
    message,
    module,
    action,
    metadata,
    userId,
    ipAddress,
    userAgent,
    requestId
  });
};

// Métodos de conveniencia
logger.logInfo = (message, options) => structuredLog('info', message, options);
logger.logWarn = (message, options) => structuredLog('warn', message, options);
logger.logError = (message, options) => structuredLog('error', message, options);

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;