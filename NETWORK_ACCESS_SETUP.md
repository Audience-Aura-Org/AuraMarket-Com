# 🌐 Network Access Setup Guide

## Problem
Your site works on your laptop but shows 404 on other devices because the development servers were only listening to `localhost`, which isn't accessible from other machines on the network.

## Solution
The servers now listen on all network interfaces (`0.0.0.0`) and can be accessed from any device on your network.

---

## Step 1: Find Your Laptop's Local IP Address

### Windows
1. Open **Command Prompt** (Win + R, type `cmd`)
2. Run: `ipconfig`
3. Look for your active connection (usually WiFi or Ethernet)
4. Find the **IPv4 Address** (typically `192.168.x.x` or `10.x.x.x`)

**Example Output:**
```
Ethernet adapter Ethernet:
   IPv4 Address. . . . . . . . . . : 192.168.1.100
   Subnet Mask . . . . . . . . . . : 255.255.255.0
```
👉 Your IP is: **192.168.1.100**

### macOS/Linux
1. Open **Terminal**
2. Run: `ifconfig`
3. Look for the `inet` address under your active network (usually `en0` or `wlan0`)

**Example Output:**
```
en0: flags=UP,BROADCAST,RUNNING...
  inet 192.168.1.100 netmask 0xffffff00
```
👉 Your IP is: **192.168.1.100**

---

## Step 2: Configure Frontend API URL

### Create .env.local file
In your **web** folder, create a file named `.env.local`:

```bash
# Copy this example and replace YOUR_IP with your actual IP
NEXT_PUBLIC_API_URL=http://192.168.1.100:5000/api/v1
```

Replace `192.168.1.100` with your actual laptop IP from Step 1.

**Location:** `aura-market/web/.env.local`

---

## Step 3: Start Development Servers

### Terminal 1 - Backend (Express Server)
```bash
cd aura-market/backend
npm run dev
```

**Output should show:**
```
🚀 Aura Market server running in development mode on port 5000
   Access locally: http://localhost:5000/api/health
   Access from other devices: http://192.168.1.100:5000/api/health
   All interfaces: http://0.0.0.0:5000/api/health
```

### Terminal 2 - Frontend (Next.js)
```bash
cd aura-market/web
npm run dev:network
```

**Output should show:**
```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Environments: .env.local
  ➜ ready - started server on 0.0.0.0:3000
```

---

## Step 4: Access from Other Devices

### On Your Laptop
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

### On Other Devices (Phone, Tablet, Another Computer)
Replace `192.168.1.100` with your actual IP from Step 1:
- Frontend: `http://192.168.1.100:3000`
- Backend: `http://192.168.1.100:5000`

---

## Troubleshooting

### ❌ "Connection Refused" or Still Getting 404

**Check 1: Verify servers are running**
- Look for the "🚀 Aura Market server running" message in backend terminal
- Look for "ready - started server" in frontend terminal

**Check 2: Verify correct IP address**
```bash
# Windows
ipconfig | findstr "IPv4"

# macOS/Linux  
ifconfig | grep "inet "
```

**Check 3: Verify .env.local exists and has correct IP**
```bash
cat aura-market/web/.env.local
# Should show: NEXT_PUBLIC_API_URL=http://192.168.1.100:5000/api/v1
```

**Check 4: Check firewall**
- Windows Defender Firewall might be blocking ports 3000 and 5000
- Go to **Windows Defender Firewall** > **Allow an app through firewall**
- Add Node.js if not present, or create rules for ports 3000 and 5000

**Check 5: Restart Next.js**
```bash
# Stop the server (Ctrl+C)
# Edit .env.local with correct IP
# Run again
npm run dev:network
```

### ❌ Port Already in Use

If you get "Address already in use :::5000" or ":::3000":

**Windows:**
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill it (replace PID with the number from previous command)
taskkill /PID YOUR_PID /F
```

**macOS/Linux:**
```bash
# Find and kill process
lsof -ti:5000 | xargs kill -9
```

### ❌ Firewall Blocking Connections

If servers are running but other devices can't access:

1. **Windows Defender Firewall**
   - Right-click **Windows Defender Firewall** > **Allow an app**
   - Find **Node.js** and enable both Private and Public
   - Or create a custom rule for ports 3000 and 5000

2. **macOS**
   - Go to **System Preferences** > **Security & Privacy** > **Firewall**
   - Click **Firewall Options** and add Node.js

3. **Linux**
   ```bash
   sudo ufw allow 3000
   sudo ufw allow 5000
   ```

---

## Scripts Available

### Backend
- `npm run dev` - Start backend on localhost only
- `npm run dev:network` - Start backend on all interfaces (0.0.0.0)
- `npm start` - Run production server

### Frontend
- `npm run dev` - Start frontend on localhost only
- `npm run dev:network` - Start frontend on all interfaces (0.0.0.0)
- `npm run build` - Build for production
- `npm start` - Start production server

---

## Important Notes

### ⚠️ Don't commit .env.local
- `.env.local` contains your local IP and should NOT be committed to git
- It's in `.gitignore` by default
- Each developer needs their own `.env.local` file

### ⚠️ Security Note
- Development servers are now accessible from your entire network
- Only use this for **local development**, not production
- Firewall will protect you from outside access

### ⚠️ IP Address Changes
- If your laptop changes WiFi networks or IP address changes, update `.env.local`
- Run `ipconfig` or `ifconfig` again to get the new IP

---

## Quick Reference

| Scenario | Command | Access |
|----------|---------|--------|
| Development (localhost) | `npm run dev` | `http://localhost:PORT` |
| Network access | `npm run dev:network` | `http://YOUR_IP:PORT` |
| Check IP (Windows) | `ipconfig` | Find IPv4 Address |
| Check IP (Mac/Linux) | `ifconfig` | Find inet address |
| Backend API | Already handles both | Auto-detects host |

---

**Created:** April 8, 2026
**Status:** ✅ Network access configured  
