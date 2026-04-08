# 🚀 Quick Network Access Setup

## TL;DR Setup (2 minutes)

### 1. Get Your IP Address
**Windows:** Open Command Prompt and run:
```bash
ipconfig | findstr "IPv4"
```
Copy the IP address (e.g., `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```
Copy the IP address (e.g., `192.168.1.100`)

### 2. Create .env.local in web folder
**File location:** `aura-market/web/.env.local`

**Content:**
```
NEXT_PUBLIC_API_URL=http://192.168.1.100:5000/api/v1
```
(Replace 192.168.1.100 with YOUR actual IP)

### 3. Start Servers (in 2 separate terminals)

**Terminal 1 - Backend:**
```bash
cd aura-market/backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd aura-market/web
npm run dev:network
```

### 4. Access from Other Devices
Replace `192.168.1.100` with your actual IP:
```
http://192.168.1.100:3000
```

---

## Why This Works

✅ **Backend now listens on all interfaces** (0.0.0.0:5000)
- Accessible from any device on your network
- Still works on localhost for your laptop

✅ **Frontend now listens on all interfaces** (0.0.0.0:3000)  
- Accessible from any device on your network
- .env.local tells frontend where backend is

✅ **API proxy configured** 
- Frontend automatically routes to backend using your IP

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Still showing 404 | Check 1: Is .env.local created? 2: Did you use correct IP? 3: Did you restart npm? |
| "Connection refused" | Backend not running. Check Terminal 1 shows server started |
| Can't access from phone | Wrong IP or firewall blocking ports 3000/5000 |

---

## Firewall Help

**Windows Firewall might be blocking access:**
1. Search "Windows Defender Firewall"
2. Click "Allow an app through firewall"  
3. Find Node.js and enable it
4. Restart your servers

---

**Need detailed help?** Read `NETWORK_ACCESS_SETUP.md`
