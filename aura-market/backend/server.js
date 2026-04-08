/**
 * server.js
 * Aura Market — Main Express Server Entry Point
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

// Initialize Socket.io Chat Events
const mapChatSockets = require('./sockets/chat.socket');
const io = mapChatSockets(server);
app.set('io', io);

// ─────────────────────────────────────────────
// 7. Express Middleware
// ─────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://space.audienceaura.org',
    'http://localhost:3000',
    process.env.WEB_CLIENT_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    message: '🚀 Aura Market API is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Root Welcome Route
app.get('/', (req, res) => {
  res.send('<h1>Welcome to the Aura Market API!</h1><p>Visit <a href="/api/health">/api/health</a> to check system status.</p>');
});

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─────────────────────────────────────────────
// 9. API Routes
// ─────────────────────────────────────────────
app.use('/api', require('./routes/v1.router')); // Unified to /api
app.use('/api/v1', require('./routes/v1.router')); // Fallback for stability


// ─────────────────────────────────────────────
// 10. Error Handling (must be LAST)
// ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─────────────────────────────────────────────
// 11. Start Server
// ─────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
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
  
  console.log(`\n🚀 Aura Market server running in ${NODE_ENV} mode on port ${PORT}`);
  console.log(`   Access locally: http://localhost:${PORT}/api/health`);
  console.log(`   Access from other devices: http://${ipAddress}:${PORT}/api/health`);
  console.log(`   All interfaces: http://0.0.0.0:${PORT}/api/health\n`);
});

// ─────────────────────────────────────────────
// 12. Handle unhandled promise rejections
// ─────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error(`❌ Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;
