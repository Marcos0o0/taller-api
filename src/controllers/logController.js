const SystemLog = require('../models/SystemLog');
const { asyncHandler } = require('../middlewares/errorHandler');

// @desc    Obtener logs del sistema
// @route   GET /api/logs
// @access  Admin
const getLogs = asyncHandler(async (req, res) => {
  const {
    level,
    action,
    userId,
    module,
    startDate,
    endDate,
    page = 1,
    limit = 50,
    sort = '-timestamp'
  } = req.query;

  const filters = {};

  if (level) filters.level = level;
  if (action) filters.action = action;
  if (userId) filters.userId = userId;
  if (module) filters.module = module;

  if (startDate || endDate) {
    filters.timestamp = {};
    if (startDate) filters.timestamp.$gte = new Date(startDate);
    if (endDate) filters.timestamp.$lte = new Date(endDate);
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort
  };

  const result = await SystemLog.findLogs(filters, options);

  res.json({
    success: true,
    data: result
  });
});

module.exports = {
  getLogs
};