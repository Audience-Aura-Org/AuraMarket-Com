/**
 * server.js
 * Auradime — Main Express Server Entry Point
 *
 * Responsibilities:
 *  - Load and validate environment variables
 *  - Connect to MongoDB
 *  - Configure Express middleware (CORS, JSON parsing, etc.)
 *  - Mount API routes
 *  - Handle 404 and global errors
 *  - Start HTTP server
 */

// ─────────────────────────────────────────────
// 1. Load environment variables first
// ─────────────────────────────────────────────
const { validateEnv, PORT, WEB_CLIENT_URL, NODE_ENV } = require('./config/env');
validateEnv();

// ─────────────────────────────────────────────
// 2. Core imports
// ─────────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const compression = require('compression');

// ─────────────────────────────────────────────
// 3. Config imports
// ─────────────────────────────────────────────
const connectDB = require('./config/database');

// ─────────────────────────────────────────────
// 4. Middleware imports
// ─────────────────────────────────────────────
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter, strictLimiter } = require('./middleware/rateLimiter');
const setLocale = require('./middleware/locale.middleware');
const { createCorsOptions, sanitizeInput, securityHeaders } = require('./middleware/security.middleware');

// ─────────────────────────────────────────────
// 5. Connect to MongoDB
// ─────────────────────────────────────────────
connectDB();

// Verify Titan SMTP connection at startup
const { verifyConnection } = require('./utils/emailService');
verifyConnection();

// ─────────────────────────────────────────────
// 6. Initialize Express app, HTTP server, & WebSockets
// ─────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1); // 🔥 ESSENTIAL: Render/Proxy identity mapping
const server = http.createServer(app);
const serverPort = Number(PORT);

// Initialize Socket.io Chat Events
const mapChatSockets = require('./sockets/chat.socket');
const io = mapChatSockets(server);
app.set('io', io);

const { startEscrowAutoReleaseWorker } = require('./services/escrowAutoRelease.service');
startEscrowAutoReleaseWorker(app);

// ─────────────────────────────────────────────
// 7. Express Middleware
// ─────────────────────────────────────────────
app.use(securityHeaders);
app.use(cors(createCorsOptions()));

app.use(compression()); // Gzip all API responses
// ── Eversend Webhook (Raw Body Requirement) ───────────────────────────
// Must be mounted before express.json() to allow raw body HMAC verification
const { eversendWebhook } = require('./controllers/payment.controller');
app.post('/api/v1/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);
app.post('/api/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use((req, res, next) => {
  if (/^\/api(\/v1)?\/payments\/.*webhook/.test(req.path)) {
    return next();
  }

  return sanitizeInput(req, res, next);
});

// Apply general rate limit to all requests
app.use('/api', apiLimiter);

// Global localization handling
app.use(setLocale);

// ─────────────────────────────────────────────
// 8. Health Check Route
// ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 Auradime API is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Root Welcome Route
app.get('/', (req, res) => {
  res.send('<h1>Welcome to the Aura Dime API!</h1><p>Visit <a href="/api/health">/api/health</a> to check system status.</p>');
});

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// 9. API Routes
// ─────────────────────────────────────────────
app.use('/api/v1', require('./routes/v1.router')); // Specific fallback first
app.use('/api', require('./routes/v1.router'));    // Unified fallback last


// ─────────────────────────────────────────────
// 10. Error Handling (must be LAST)
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// 11. Start Server
// ─────────────────────────────────────────────
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${serverPort} is already in use.`);
    console.error('Stop the existing backend process or start this app with a different PORT value.');
    console.error('Linux/macOS: lsof -i :5000 && kill <PID>');
    console.error('Windows: netstat -ano | findstr :5000 then Stop-Process -Id <PID>\n');
    process.exit(1);
  }

  throw err;
});

server.listen(serverPort, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let ipAddress = 'localhost';
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ipAddress = addr.address;
        break;
      }
    }
  }
  
  console.log(`\n🚀 Auradime server running in ${NODE_ENV} mode on port ${serverPort}`);
  console.log(`   Access locally: http://localhost:${serverPort}/api/health`);
  console.log(`   Access from other devices: http://${ipAddress}:${serverPort}/api/health`);
  console.log(`   All interfaces: http://0.0.0.0:${serverPort}/api/health\n`);
});

// Increase server timeouts for large file uploads (100MB videos)
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000; // Slightly more than keepAlive to avoid race conditions
server.headersTimeout = 620000;

// ─────────────────────────────────────────────
// 12. Handle unhandled promise rejections
// ─────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Draining HTTP and socket connections...`);
  io.close(() => {
    server.close(() => {
      console.log('✅ Server drained cleanly.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 15000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
