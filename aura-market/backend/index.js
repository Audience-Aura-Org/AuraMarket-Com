// Simple entry file for hosting platforms that expect `index.js`.
// It delegates to the existing `server.js` which starts the Express app.
try {
  require('./server');
} catch (err) {
  console.error('Failed to start server via index.js:', err);
  process.exit(1);
}
