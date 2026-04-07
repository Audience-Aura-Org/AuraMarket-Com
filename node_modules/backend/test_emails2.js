require('dotenv').config({ path: 'c:\\Users\\Zero\\Desktop\\AuraMarket\\aura-market\\backend\\.env' });
const mongoose = require('mongoose');

// Need to run schema dynamically inside script so it doesn't fail on missing requires
const EmailLogSchema = new mongoose.Schema({
  recipient_email: String,
  recipient_user_id: mongoose.Schema.Types.ObjectId,
  subject: String,
  message_preview: String,
  role: String,
  status: String,
  error: String,
  message_id: String,
  timestamp: Date
}, { collection: 'emaillogs' });

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const logs = await EmailLog.find().sort({ timestamp: -1 }).limit(10);
        console.log("=== LATEST 10 EMAIL LOGS ===");
        logs.forEach(l => {
            console.log(`[${l.timestamp}] To: ${l.recipient_email} | Role: ${l.role} | Status: ${l.status} | Err: ${l.error || 'None'} | Sub: ${l.subject}`);
        });
        process.exit(0);
    } catch(e) {
        console.error("DB Script Error:", e);
        process.exit(1);
    }
})();
