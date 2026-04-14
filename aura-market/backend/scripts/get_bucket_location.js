require('dotenv').config();
const { S3Client, GetBucketLocationCommand } = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET;
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

(async () => {
  try {
    const data = await s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
    console.log('Bucket location result:', data);
  } catch (err) {
    console.error('getBucketLocation failed:', err.name || err.message);
    process.exit(1);
  }
})();
