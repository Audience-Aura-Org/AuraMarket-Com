# Step 1 — Backend Setup ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step established the foundational Node.js + Express + MongoDB backend for Aura Market. All MVC folders, environment configuration, database connection, and error handling middleware are in place.

---

## Files Created

| File | Description |
|------|-------------|
| `backend/.env` | Real environment variables (MongoDB URI, JWT secret, etc.) |
| `backend/.env.example` | Template for other developers |
| `backend/.gitignore` | Prevents `.env` and `node_modules` from being committed |
| `backend/config/database.js` | MongoDB Atlas connection via Mongoose |
| `backend/config/env.js` | Loads and validates required environment variables at startup |
| `backend/middleware/errorHandler.js` | Global JSON error handler (handles Mongoose, JWT, validation errors) |
| `backend/middleware/notFound.js` | 404 handler for undefined routes |
| `backend/server.js` | Main Express server entry point |

---

## Folder Structure

```
backend/
├── config/
│   ├── database.js       ✅
│   └── env.js            ✅
├── controllers/          (populated in Steps 2–10)
├── middleware/
│   ├── errorHandler.js   ✅
│   └── notFound.js       ✅
├── models/               (populated in Steps 2–10)
├── routes/               (populated in Steps 2–10)
├── services/             (populated in Steps 7–9)
├── sockets/              (populated in Step 8)
├── .env                  ✅
├── .env.example          ✅
├── .gitignore            ✅
├── package.json          ✅
└── server.js             ✅
```

---

## Installed Packages

### Dependencies
| Package | Purpose |
|---------|---------|
| `express` | HTTP server framework |
| `mongoose` | MongoDB ODM |
| `dotenv` | Environment variable loader |
| `cors` | Cross-Origin Resource Sharing |
| `jsonwebtoken` | JWT authentication |
| `bcryptjs` | Password hashing |

### Dev Dependencies
| Package | Purpose |
|---------|---------|
| `nodemon` | Auto-restarts server on file changes |

---

## Environment Variables Configured

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...aura-market
JWT_SECRET=...
JWT_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=...  (to be filled)
FLUTTERWAVE_SECRET_KEY=... (to be filled)
PAYSTACK_SECRET_KEY=...    (to be filled)
WEB_CLIENT_URL=http://localhost:3000
```

---

## API Routes Available

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check — confirms server is live |

> Remaining routes will be uncommented in `server.js` as each step is completed.

---

## How to Start the Server

```bash
# Development (auto-restart on change)
cd backend
npm run dev

# Production
npm start
```

---

## Verification
- ✅ `npm run dev` starts the server with no errors
- ✅ Environment variables validated on startup
- ✅ MongoDB Atlas connected: `cluster0.dl8yopt.mongodb.net`
- ✅ `GET /api/health` returns `200 OK`

---

## Next Step
👉 [Step 2 — User System](./step2-user-system.md)
