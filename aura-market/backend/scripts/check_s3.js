// scripts/check_s3.js
// Quick script to verify AWS S3 bucket accessibility using env vars

require('dotenv').config();
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET;
if (!bucket) {
  console.error('AWS_S3_BUCKET not set in environment');
  process.exit(2);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

(async () => {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ S3 bucket reachable: ${bucket}`);
  } catch (err) {
    console.error(`❌ S3 bucket check failed for ${bucket}:`, err.name || err.message);
    process.exit(1);
  }
})();
