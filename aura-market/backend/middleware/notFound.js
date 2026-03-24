/**
 * middleware/notFound.js
 * Handles requests to undefined routes.
 * Creates a 404 error and passes it to the global error handler.
 */

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = notFound;
