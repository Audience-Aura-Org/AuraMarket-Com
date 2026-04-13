const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log error using structured logger
  logger.error(`${err.name}: ${err.message}`, { 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user ? req.user._id : 'anonymous'
  });

  // Determine HTTP status code
  let statusCode = err.statusCode || 500;

  // Handle specific Mongoose errors
  if (err.name === 'CastError') {
    statusCode = 400;
    err.message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.code === 11000) {
    // Duplicate field value (e.g., duplicate email)
    const field = Object.keys(err.keyValue)[0];
    statusCode = 400;
    err.message = `An account with this ${field} already exists.`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    err.message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    err.message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    err.message = 'Your session has expired. Please log in again.';
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
