<!-- S3 Video Playback Fix Guide -->

# Video Status Playback Fix - S3 CORS Configuration

## Problem
Video statuses show "loading" but never play, with browser console error:
```
[Video] Playback blocked or failed: Failed to load because no supported source was found.
```

## Root Cause
AWS S3 bucket doesn't have CORS (Cross-Origin Resource Sharing) headers configured. Browsers block cross-origin video playback without explicit CORS policy.

## Solution

### Step 1: Apply CORS Configuration to S3 Bucket

Run the provided script to automatically configure your S3 bucket:

```bash
cd backend
node scripts/configure-s3-cors.js
```

**What it does:**
- Enables `GET` and `HEAD` requests from all origins (`*`)
- Sets up local development origins (localhost:3000, localhost:5000)
- Configures proper CORS headers so browsers allow video playback

### Step 2: Manual S3 Configuration (Alternative)

If the script fails, configure CORS manually in AWS Console:

1. Go to **AWS S3 Console** → Your bucket
2. Click **Permissions** tab
3. Scroll to **CORS** section
4. Click **Edit** and paste this policy:

```json
[
  {
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "x-amz-server-side-encryption"],
    "MaxAgeSeconds": 3000
  },
  {
    "AllowedMethods": ["GET", "HEAD", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "http://localhost:5000"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

5. Click **Save changes**

### Step 3: Code Updates (Already Applied)

The `StatusViewer.js` component has been updated with:
- Better video error handling and logging
- Proper `crossOrigin="anonymous"` attribute
- Error event listener that logs specific issues

## Testing

1. Create a new video status
2. Open the status viewer
3. Video should now load and play without "loading" infinite state
4. Check browser DevTools → Console for any remaining errors

## Troubleshooting

### Still seeing errors?
1. **Clear S3 cache**: S3 caches CORS for a few minutes. Wait 5 minutes or upload a new video
2. **Check bucket name**: Verify `AWS_S3_BUCKET` environment variable is correct
3. **Verify credentials**: Ensure AWS credentials have S3 access permissions
4. **Check video URL**: Video URL should be from your S3 bucket (e.g., `https://your-bucket.s3.region.amazonaws.com/...`)

### Video plays but shows playback errors?
- Ensure video file is properly encoded
- Video MIME type must be `video/mp4` or `video/webm`
- Maximum video size: 100MB
- Maximum video duration: 1 minute

## Environment Variables Needed

```env
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=eu-north-1  # or your region
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_ENABLED=true
```

## Related Files Modified

- `/backend/scripts/configure-s3-cors.js` - New CORS configuration script
- `/web/components/status/StatusViewer.js` - Improved video error handling
