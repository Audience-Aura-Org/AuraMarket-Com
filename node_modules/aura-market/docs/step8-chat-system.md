# Step 8 — Chat System ✅

**Status:** Complete  
**Date Completed:** 2026-03-13

---

## Overview
This step constructs the realtime messaging infrastructure. Utilizing `socket.io` alongside Express, we enable instant communication between Customers and Vendors without demanding manual page reloads.

---

## Files Created / Modified

| File | Description |
|------|-------------|
| `backend/models/Message.model.js` | Chat schema holding basic string texts alongside an optional `product_reference`. This allows mapping a "Product Card" natively into chat bubbles for the 'chat-to-buy' feature. |
| `backend/sockets/chat.socket.js` | The Socket.IO connection manager. Facilitates joining dynamic rooms mapped natively to MongoDB User IDs. Catches inbound texts, maps them to the Database mapping constraints securely, and immediately emits payloads globally (`receive_message` & `read_receipt`). |
| `backend/controllers/chat.controller.js` | HTTP fallbacks utilized strictly when the User accesses the App for the first time. The `getUserInbox` leverages an advanced MongoDB Aggregation Pipeline to cleanly merge scattered conversation clusters into one unified 'Inbox list'. |
| `backend/routes/chat.routes.js` | Maps REST endpoints `/api/chat/` dynamically locked securely behind authentication. |
| `backend/server.js` | Upgraded to bind WebSockets onto the Express HTTP core, plus `/api/chat` router. |

---

## Technical Details 

### 1. Real-Time Transport (WebSockets)
We avoided setting timers hitting `/api/chat` every X seconds (poll-fetching) since holding constant open HTTP requests kills mobile battery.
Using `socket.io`:
1. The Frontend passes `auth: { userId: ... }` specifically during the initial handshake.
2. The Backend maps them into an isolated Room: `socket.join(userId)`.
3. When User A writes to User B, we instantly invoke `io.to(User B).emit('receive_message', ...)`. The message literally pushes across the wire in single-digit milliseconds.

### 2. Inbox Aggregation
To get a neat WhatsApp-style list of distinct conversations, the `getUserInbox` builds a complex `$group` match natively inside MongoDB. It evaluates whether the user was the sender or receiver natively, groups the block based uniformly on Both IDs string-wise securely, and parses exclusively the `$first: '$$ROOT'` message for efficiency.

### 3. Read Receipts
The flow natively supports WhatsApp-like hooks. When someone renders a message object onto their screen, the frontend fires a `mark_read` socket emit. The Server securely updates the Document (`{ read_status: true }`), then back-pings the sender with `read_receipt`.

---

## Next Step
👉 [Step 9 — Logistics Partner System](./step9-logistics-system.md) (Expected next.)
