/**
 * AWS CloudFront CDN Setup Script (UPGRADED)
 * Configures SECURE CDN distribution with OAC and Automatic S3 Policy updates
 */

const { 
  CloudFrontClient, 
  CreateDistributionCommand, 
  CreateOriginAccessControlCommand 
} = require('@aws-sdk/client-cloudfront');
const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const { 
  AWS_ACCESS_KEY_ID, 
  AWS_SECRET_ACCESS_KEY, 
  AWS_REGION, 
  AWS_S3_BUCKET 
} = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_S3_BUCKET) {
  console.error('❌ Missing required AWS credentials in .env');
  process.exit(1);
}

const config = {
  region: AWS_REGION || 'eu-north-1',
  credentials: { 
    accessKeyId: AWS_ACCESS_KEY_ID, 
    secretAccessKey: AWS_SECRET_ACCESS_KEY 
  },
};

const cfClient = new CloudFrontClient(config);
const s3Client = new S3Client(config);

async function setupCloudFront() {
  try {
    console.log(`\n🚀 Starting Auradime CDN Setup for: ${AWS_S3_BUCKET}`);

    // 1. Create Origin Access Control (OAC)
    console.log('🛡️  Creating Origin Access Control (OAC)...');
    const oacResponse = await cfClient.send(new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: `Auradime-OAC-${Date.now()}`,
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      },
    }));
    const oacId = oacResponse.OriginAccessControl.Id;
    console.log(`✅ OAC Created: ${oacId}`);

    // 2. Create Distribution
    console.log('🌐 Creating CloudFront Distribution...');
    const distResponse = await cfClient.send(new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: `aura-market-${Date.now()}`,
        Comment: 'Auradime - Media CDN',
        Enabled: true,
        HttpVersion: 'http2and3',
        Origins: {
          Quantity: 1,
          Items: [{
            Id: 'S3Origin',
            DomainName: `${AWS_S3_BUCKET}.s3.${config.region}.amazonaws.com`,
            S3OriginConfig: { OriginAccessIdentity: '' },
            OriginAccessControlId: oacId,
            OriginShield: { 
              Enabled: true, 
              OriginShieldRegion: config.region 
            },
          }],
        },
        DefaultCacheBehavior: {
          TargetOriginId: 'S3Origin',
          ViewerProtocolPolicy: 'redirect-to-https',
          AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // Managed-CachingOptimized
          OriginRequestPolicyId: '216adef5-5c7f-47e4-b989-5492eafa07d3', // Managed-CORS-S3Origin
          Compress: true,
        },
        PriceClass: 'PriceClass_All',
        ViewerCertificate: { CloudFrontDefaultCertificate: true },
      }
    }));
    const dist = distResponse.Distribution;
    console.log(`✅ Distribution Created: ${dist.DomainName}`);

    // 3. Update S3 Bucket Policy
    console.log('📝 Updating S3 Bucket Policy for security...');
    const policy = {
      Version: '2012-10-17',
      Statement: [{
        Sid: 'AllowCloudFrontServicePrincipalReadOnly',
        Effect: 'Allow',
        Principal: { Service: 'cloudfront.amazonaws.com' },
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${AWS_S3_BUCKET}/*`,
        Condition: { 
          StringEquals: { 
            'AWS:SourceArn': dist.ARN 
          } 
        }
      }]
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: AWS_S3_BUCKET,
      Policy: JSON.stringify(policy),
    }));
    console.log('✅ S3 Bucket Policy Updated!');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 SETUP COMPLETE!');
    console.log(`🔗 CDN Domain: ${dist.DomainName}`);
    console.log(`📊 Status:     ${dist.Status}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Next Step: Add this to your web folder .env:');
    console.log(`NEXT_PUBLIC_CDN_URL=${dist.DomainName}`);
    console.log('\n⏳ Note: It takes 10-15 minutes to deploy globally.');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    if (err.message.includes('Access Denied')) {
      console.error('\n⚠️  Permission Error: Please ensure your IAM user has:');
      console.error('   1. CloudFrontFullAccess');
      console.error('   2. AmazonS3FullAccess (to update bucket policy)');
    }
    process.exit(1);
  }
}

setupCloudFront();
