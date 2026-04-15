require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

(async () => {
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    console.log('Accessible buckets:');
    (data.Buckets || []).forEach(b => console.log('-', b.Name));
  } catch (err) {
    console.error('List buckets failed:', err.name || err.message);
    process.exit(1);
  }
})();
