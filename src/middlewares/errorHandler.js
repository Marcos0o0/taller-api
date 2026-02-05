// src/middlewares/errorHandler.js

// Middleware para manejar funciones asíncronas
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
  
  // Middleware para rutas no encontradas
  const notFound = (req, res, next) => {
    const error = new Error(`Ruta no encontrada - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  // Middleware de manejo de errores
  const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    console.error('Error:', {
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
      path: req.path,
      method: req.method,
      requestId: req.id
    });
  
    res.status(statusCode).json({
      success: false,
      error: {
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });
  };
  
  module.exports = {
    asyncHandler,
    notFound,
    errorHandler
  };