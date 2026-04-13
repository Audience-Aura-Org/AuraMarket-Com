const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const EmailLog = require('./models/EmailLog.model.js');

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const logs = await EmailLog.find().sort({ createdAt: -1 }).limit(10);
        console.log("=== EMAIL LOGS ===");
        logs.forEach(l => {
            console.log(`[${l.createdAt}] To: ${l.recipient_email} | Role: ${l.role} | Status: ${l.status} | Err: ${l.error || 'None'}`);
        });
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
