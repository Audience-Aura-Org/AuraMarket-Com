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

// Quiet AWS SDK v3 runtime noise while EC2 nodes are upgraded.
// Keep Node >= 22 as the real production fix.
if (!process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE) {
  process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE = '1';
}

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
const { startFoodAcceptanceTimeoutWorker } = require('./services/foodAcceptanceTimeout.service');
startFoodAcceptanceTimeoutWorker(app);
const { startDisputeWindowWorker } = require('./services/disputeWindowEnforcement.service');
startDisputeWindowWorker(app);
const { startCancelRateMonitor } = require('./services/cancelRateMonitor.service');
startCancelRateMonitor(app);
const { startOrphanDetector } = require('./services/orphanDetector.service');
startOrphanDetector(app);
const { startIntercityDispatchTimeoutWorker } = require('./services/intercityDispatchTimeout.service');
startIntercityDispatchTimeoutWorker(app);
const { startAvgDeliveryMinutesJob } = require('./services/avgDeliveryMinutes.service');
startAvgDeliveryMinutesJob();
const { startDelayedRiderDispatchWorker } = require('./services/delayedRiderDispatch.service');
startDelayedRiderDispatchWorker(app);
const { startIntercityArrivalLapseWorker } = require('./services/intercityArrivalLapse.service');
startIntercityArrivalLapseWorker(app);
const { startStaleTransactionCleanupWorker } = require('./services/staleTransactionCleanup.service');
startStaleTransactionCleanupWorker(app);

// Phase 3 Step 11 — Hourly dine-feed cache invalidation
// open_status / next_status_change_at is computed at cache-write time (Africa/Douala).
// Clear all dine:* keys every hour so the feed never shows a stale open/closed badge
// longer than one cache TTL (5 min) after the hour turns.
(function startDineCacheInvalidationWorker() {
  const cache = require('./utils/cache');
  const clearDineCache = () => {
    try {
      for (const key of cache.keys()) {
        if (key.startsWith('dine:')) cache.delete(key);
      }
    } catch (err) {
      console.error('[dineCacheInvalidation] failed:', err.message);
    }
  };

  // Align to the top of the next full hour, then repeat every 60 min
  const now = new Date();
  const msUntilNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  setTimeout(() => {
    clearDineCache();
    const t = setInterval(clearDineCache, 60 * 60 * 1000);
    if (t.unref) t.unref();
  }, msUntilNextHour);
})();

const { drainQueues } = require('./services/jobQueue.service');
const { getRedisStatus, closeRedis } = require('./config/redis');

// ─────────────────────────────────────────────
// 7. Express Middleware
// ─────────────────────────────────────────────
// ── CORS Preflight (must be first — mobile browsers send OPTIONS before POST) ─
// Use a JS RegExp instead of a string wildcard: path-to-regexp v8+ on the
// production server rejects both '*' and '/*' as invalid pattern syntax.
app.options(/\/.*/, cors(createCorsOptions()));
app.use(securityHeaders);
app.use(cors(createCorsOptions()));

app.use(compression()); // Gzip all API responses
// ── Webhook routes (Raw Body Requirement) ─────────────────────────────
// Must be mounted before express.json() to allow raw body signature verification
const {
  eversendWebhook,
  payunitWebhook,
  pawapayDepositWebhook,
  pawapayRefundWebhook,
  pawapayCheckoutWebhook,
} = require('./controllers/payment.controller');
const { pawapayPayoutWebhook } = require('./controllers/withdrawal.controller');
app.post('/api/v1/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);
app.post('/api/payments/eversend/webhook', express.raw({ type: 'application/json' }), eversendWebhook);
// PayUnit signs the exact callback bytes. Mount before express.json() so valid
// MTN/Orange callbacks are verified against the original body, not a
// JSON.stringify reconstruction.
app.post('/api/v1/payments/payunit/webhook', express.raw({ type: 'application/json' }), payunitWebhook);
app.post('/api/payments/payunit/webhook', express.raw({ type: 'application/json' }), payunitWebhook);
// PawaPay webhooks — raw body required for Content-Digest / RFC-9421 signature verification
app.post('/api/v1/payments/pawapay/webhook/deposit', express.raw({ type: 'application/json' }), pawapayDepositWebhook);
app.post('/api/payments/pawapay/webhook/deposit', express.raw({ type: 'application/json' }), pawapayDepositWebhook);
app.post('/api/v1/payments/pawapay/webhook/checkout', express.raw({ type: 'application/json' }), pawapayCheckoutWebhook);
app.post('/api/payments/pawapay/webhook/checkout', express.raw({ type: 'application/json' }), pawapayCheckoutWebhook);
app.post('/api/v1/payments/pawapay/webhook/refund', express.raw({ type: 'application/json' }), pawapayRefundWebhook);
app.post('/api/payments/pawapay/webhook/refund', express.raw({ type: 'application/json' }), pawapayRefundWebhook);
// PawaPay payout (disbursement) webhook — fires when a withdrawal payout settles
app.post('/api/v1/payments/pawapay/webhook/payout', express.raw({ type: 'application/json' }), pawapayPayoutWebhook);
app.post('/api/payments/pawapay/webhook/payout', express.raw({ type: 'application/json' }), pawapayPayoutWebhook);

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
    redis: getRedisStatus(),
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
  io.close(async () => {
    await drainQueues({ timeoutMs: 10000 });
    await closeRedis();
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
