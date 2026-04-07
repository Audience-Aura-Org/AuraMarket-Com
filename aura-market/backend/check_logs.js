require('dotenv').config();
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
  timestamp: { type: Date, default: Date.now }
}, { collection: 'emaillogs' });

const EmailLog = mongoose.model('EmailLog', EmailLogSchema);

(async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error("MONGODB_URI is undefined");
        await mongoose.connect(uri);
        const logs = await EmailLog.find({ timestamp: { $gte: new Date(Date.now() - 600000) } }).sort({ timestamp: -1 }); // Last 10 mins
        console.log(`=== LATEST ${logs.length} EMAIL LOGS (Last 10 mins) ===`);
        logs.forEach(l => {
            console.log(`[${l.timestamp.toISOString()}] To: ${l.recipient_email} | Role: ${l.role} | Status: ${l.status} | Err: ${l.error || 'None'} | Sub: ${l.subject}`);
        });
        process.exit(0);
    } catch(e) {
        console.error("DB Script Error:", e.message);
        process.exit(1);
    }
})();
