require('dotenv').config();

const {
  S3Client,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
} = require('@aws-sdk/client-s3');

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION || 'us-east-1';

const managedRules = [
  {
    ID: 'auradime-delete-status-media-after-3-days',
    Status: 'Enabled',
    Filter: { Prefix: 'statuses/' },
    Expiration: { Days: 3 },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  },
  {
    ID: 'auradime-delete-temp-uploads-after-1-day',
    Status: 'Enabled',
    Filter: { Prefix: 'temp/' },
    Expiration: { Days: 1 },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  },
  {
    ID: 'auradime-delete-logs-after-30-days',
    Status: 'Enabled',
    Filter: { Prefix: 'logs/' },
    Expiration: { Days: 30 },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  },
  {
    ID: 'auradime-delete-chat-media-after-180-days',
    Status: 'Enabled',
    Filter: { Prefix: 'chat-media/' },
    Expiration: { Days: 180 },
    AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
  },
];

async function main() {
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is required.');
  }

  const s3 = new S3Client({
    region,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });

  let existingRules = [];
  try {
    const current = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
    existingRules = current.Rules || [];
  } catch (error) {
    if (error.name !== 'NoSuchLifecycleConfiguration') {
      throw error;
    }
  }

  const managedIds = new Set(managedRules.map((rule) => rule.ID));
  const rules = [
    ...existingRules.filter((rule) => !managedIds.has(rule.ID)),
    ...managedRules,
  ];

  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: { Rules: rules },
  }));

  console.log(`Applied ${managedRules.length} AuraDime lifecycle rules to bucket ${bucket}.`);
  managedRules.forEach((rule) => {
    console.log(`- ${rule.Filter.Prefix} expires after ${rule.Expiration.Days} day(s).`);
  });
}

main().catch((error) => {
  console.error(`Failed to apply S3 lifecycle rule: ${error.message}`);
  process.exit(1);
});
