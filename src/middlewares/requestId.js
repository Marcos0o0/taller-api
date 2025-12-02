const { v4: uuidv4 } = require('uuid');

// Middleware para agregar ID único a cada request
const requestId = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

module.exports = requestId;