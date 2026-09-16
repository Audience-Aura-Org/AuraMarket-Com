const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('../utils/logger');

// Force Google DNS to bypass local DNS issues with SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // Timeout after 15s instead of 30s
      heartbeatFrequencyMS: 10000,    // Check connection every 10s
      family: 4,                      // Force IPv4 for DNS resolution
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 25),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 2),
      maxIdleTimeMS: Number(process.env.MONGODB_MAX_IDLE_MS || 60000),
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Drop stale unique index on shipments.order_id that blocks P2P shipments
    try {
      const col = conn.connection.collection('shipments');
      const indexes = await col.indexes();
      const stale = indexes.find(
        (idx) => idx.name === 'order_id_1' && idx.unique
      );
      if (stale) {
        await col.dropIndex('order_id_1');
        logger.info('🗑️  Dropped stale unique index order_id_1 on shipments');
      }
    } catch (idxErr) {
      // Non-fatal — log and continue
      if (!idxErr.message?.includes('not found')) {
        logger.warn(`⚠️ Could not drop stale order_id_1 index: ${idxErr.message}`);
      }
    }
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    
    if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
      logger.error('⚠️ DNS Resolution failed for MongoDB Atlas. This often happens due to local network restrictions or DNS issues.');
      logger.error('👉 TIP: Try changing your system DNS to 8.8.8.8 or check if your firewall blocks SRV records.');
    }
    
    if (error.message.includes('ENOTFOUND')) {
      logger.warn('⚠️ DNS Resolution failed for MongoDB Atlas. If you are on a restricted network, check your DNS settings.');
    }
  }
};

module.exports = connectDB;
