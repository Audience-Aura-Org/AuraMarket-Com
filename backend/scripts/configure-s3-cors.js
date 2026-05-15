/**
 * Configure S3 CORS Policy
 * Enables video/media playback from browser with crossOrigin="anonymous"
 * 
 * Run: node scripts/configure-s3-cors.js
 */

const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET,
} = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
  console.error('❌ Missing required AWS credentials in environment variables');
  process.exit(1);
}

const s3Client = new S3Client({
  region: AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const corsConfiguration = {
  CORSRules: [
    {
      AllowedMethods: ['GET', 'HEAD', 'PUT'],
      AllowedOrigins: ['*'], // Allow all origins (stricter in production)
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'x-amz-server-side-encryption'],
      MaxAgeSeconds: 3000,
    },
    {
      AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST'],
      AllowedOrigins: ['http://localhost:3000', 'http://localhost:5000'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3000,
    },
  ],
};

async function configureCORS() {
  try {
    console.log(`🔧 Configuring CORS for bucket: ${AWS_S3_BUCKET}`);
    
    const command = new PutBucketCorsCommand({
      Bucket: AWS_S3_BUCKET,
      CORSConfiguration: corsConfiguration,
    });

    await s3Client.send(command);
    console.log('✅ CORS configuration applied successfully!');
    console.log('\nCORS Rules:');
    console.log(JSON.stringify(corsConfiguration, null, 2));
  } catch (error) {
    console.error('❌ Failed to configure CORS:', error.message);
    if (error.Code === 'NoSuchBucket') {
      console.error(`\n⚠️  Bucket "${AWS_S3_BUCKET}" does not exist.`);
      console.error('   Create the bucket first, then run this script again.');
    }
    process.exit(1);
  }
}

configureCORS();
