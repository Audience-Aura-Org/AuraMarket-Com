/**
 * test-s3-upload.js
 * Test script to validate S3 upload infrastructure
 * Run with: node test-s3-upload.js
 */

require('dotenv').config();
const { uploadToS3, uploadMultipleToS3, isS3Enabled } = require('./utils/s3');

async function testS3Upload() {
  console.log('\n🧪 === S3 Upload Infrastructure Test ===\n');

  // Test 1: Check if S3 is enabled
  console.log('Test 1: S3 Enabled Status');
  const s3Enabled = isS3Enabled();
  console.log(`  ✅ S3 Enabled: ${s3Enabled}`);
  
  if (!s3Enabled) {
    console.log('  ❌ S3 is not enabled. Check AWS_S3_ENABLED in .env');
    process.exit(1);
  }

  // Test 2: Verify environment variables
  console.log('\nTest 2: Environment Variables');
  const vars = {
    'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing',
    'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing',
    'AWS_REGION': process.env.AWS_REGION || 'not set',
    'AWS_S3_BUCKET': process.env.AWS_S3_BUCKET || 'not set',
  };
  
  Object.entries(vars).forEach(([key, val]) => {
    console.log(`  ${key}: ${val}`);
  });

  // Test 3: Test single file upload with dummy buffer
  console.log('\nTest 3: Single File Upload');
  try {
    // Create a test buffer (dummy image data)
    const testBuffer = Buffer.from('test image content', 'utf-8');
    const testFileName = 'test-image-' + Date.now() + '.jpg';
    
    console.log(`  📝 Uploading test file: ${testFileName}`);
    const result = await uploadToS3(testBuffer, testFileName, 'test-folder');
    
    console.log(`  ✅ Upload successful!`);
    console.log(`  📍 S3 URL: ${result.url}`);
    console.log(`  🔑 S3 Key: ${result.key}`);
    console.log(`  📦 Bucket: ${result.bucket}`);
  } catch (err) {
    console.log(`  ❌ Upload failed: ${err.message}`);
    process.exit(1);
  }

  // Test 4: Test batch upload
  console.log('\nTest 4: Multiple Files Upload');
  try {
    const testBuffers = [
      Buffer.from('test 1', 'utf-8'),
      Buffer.from('test 2', 'utf-8'),
    ];
    const testFileNames = [
      'test-batch-1-' + Date.now() + '.jpg',
      'test-batch-2-' + Date.now() + '.jpg',
    ];
    
    console.log(`  📝 Uploading ${testFileNames.length} test files...`);
    const results = await uploadMultipleToS3(testBuffers, testFileNames, 'test-batch');
    
    console.log(`  ✅ Batch upload successful!`);
    results.forEach((result, idx) => {
      console.log(`  📍 File ${idx + 1}: ${result.url}`);
    });
  } catch (err) {
    console.log(`  ❌ Batch upload failed: ${err.message}`);
    process.exit(1);
  }

  console.log('\n✅ === All S3 Upload Tests Passed! ===\n');
  console.log('Summary:');
  console.log('  ✅ S3 module loaded and enabled');
  console.log('  ✅ AWS credentials configured');
  console.log('  ✅ Single file upload working');
  console.log('  ✅ Batch file upload working');
  console.log('  ✅ Files successfully stored in S3 bucket');
  console.log('\n📌 Ready for production use!\n');
}

testS3Upload().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
