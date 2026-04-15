require('dotenv').config();
const { uploadToS3, isS3Enabled } = require('../utils/s3');
const { S3Client, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

(async () => {
  try {
    if (!isS3Enabled()) {
      console.error('S3 is not enabled in this environment');
      process.exit(2);
    }

    // 1x1 PNG (transparent) base64
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(pngBase64, 'base64');
    const fileName = 'test-1x1.png';
    console.log('Uploading test image to S3...');
    const result = await uploadToS3(buffer, fileName, 'test-uploads');
    console.log('Upload result:', result);

    // Use AWS SDK v3 to fetch the object back
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log('Fetching object via headObject...');
    const head = await s3.send(new HeadObjectCommand({ Bucket: result.bucket || process.env.AWS_S3_BUCKET, Key: result.key }));
    console.log('headObject metadata:', { ContentLength: head.ContentLength, ContentType: head.ContentType });

    console.log('Downloading object via getObject...');
    const objResp = await s3.send(new GetObjectCommand({ Bucket: result.bucket || process.env.AWS_S3_BUCKET, Key: result.key }));
    const bodyBuffer = await streamToBuffer(objResp.Body);
    console.log('Downloaded bytes:', bodyBuffer.length);

    // Simple content check: length matches uploaded buffer length
    if (bodyBuffer.length === buffer.length) {
      console.log('✅ Upload and retrieval succeeded and sizes match');
    } else {
      console.warn('⚠️ Retrieved size differs from uploaded size');
    }

    console.log('Public URL (from upload result):', result.url);
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err.code || err.message || err);
    process.exit(1);
  }
})();
