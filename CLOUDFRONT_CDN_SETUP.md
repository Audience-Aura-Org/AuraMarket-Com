<!-- CloudFront CDN Setup Guide -->

# AWS CloudFront CDN Setup - Complete Guide

## What is CloudFront?

CloudFront is AWS's global CDN (Content Delivery Network) that:
- **Caches** videos at 400+ edge locations worldwide
- **Serves** from the location closest to your users (5-10x faster)
- **Compresses** videos automatically (gzip + brotli)
- **Reduces** S3 bandwidth costs by ~70%
- **Enables** HTTP/2 for faster connections

## Quick Setup (5 minutes)

### Step 1: Run the Setup Script

```bash
cd backend
node scripts/setup-cloudfront-cdn.js
```

This creates a CloudFront distribution automatically.

**Output will show:**
```
✅ CloudFront distribution created!

Distribution Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID:           E1234ABCD
Domain:       d1234abcd.cloudfront.net
Status:       InProgress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ Wait 10-15 minutes for deployment...
```

### Step 2: Add CloudFront URL to Environment

Once deployment completes, add to `.env`:

```env
NEXT_PUBLIC_CDN_URL=d1234abcd.cloudfront.net
# Keep S3 as backup
AWS_S3_BUCKET=aura-market-frontend
AWS_REGION=eu-north-1
```

### Step 3: Test CloudFront

Compare response times:

**S3 (slow):**
```
https://aura-market-frontend.s3.eu-north-1.amazonaws.com/statuses/video-123.mp4
```

**CloudFront (fast):**
```
https://d1234abcd.cloudfront.net/statuses/video-123.mp4
```

Both URLs return the same video, but CloudFront serves from edge location.

## Advanced Setup (Optional)

### Custom Domain (like cdn.yourdomain.com)

1. **Get SSL Certificate:**
   - AWS Console → ACM (Certificate Manager)
   - Request certificate for `cdn.yourdomain.com`
   - Validate with DNS

2. **Update CloudFront Distribution:**
   - AWS Console → CloudFront → Distribution ID
   - Edit Distribution
   - Add "Alternate Domain Names": `cdn.yourdomain.com`
   - Select SSL Certificate
   - Save

3. **Update DNS:**
   - Add CNAME record:
     ```
     cdn.yourdomain.com → d1234abcd.cloudfront.net
     ```

4. **Update Environment:**
   ```env
   NEXT_PUBLIC_CDN_URL=cdn.yourdomain.com
   ```

### Cache Settings

Default cache times:
- **Videos**: 7 days (long cache because filenames include timestamp)
- **Images**: 1 day
- **Dynamic content**: Not cached

Modify in `scripts/setup-cloudfront-cdn.js` if needed.

## Performance Comparison

### Before CloudFront
```
User in Singapore
├─ S3 in Frankfurt (Europe)
├─ Network latency: 300-400ms
├─ Video size: 50MB uncompressed
├─ Load time: 5-8 seconds
└─ Bandwidth cost: $0.09 per GB
```

### With CloudFront
```
User in Singapore
├─ CloudFront edge in Singapore
├─ Network latency: 20-50ms
├─ Video size: 15MB (70% compressed)
├─ Load time: 300-500ms
└─ Bandwidth cost: $0.02 per GB (78% savings)
```

## Code Integration

### Option 1: Automatic (Recommended)
Media URL configuration handles both S3 and CloudFront:

```javascript
import { getVideoStatusUrl } from '@/utils/mediaUrl';

const videoUrl = getVideoStatusUrl('video-123.mp4');
// Returns CloudFront URL if NEXT_PUBLIC_CDN_URL set
// Falls back to S3 if not
```

### Option 2: Manual in StatusViewer.js
```javascript
const getCDNUrl = (s3Url) => {
  const cdnDomain = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnDomain) return s3Url; // Fallback to S3
  
  // Replace S3 domain with CloudFront domain
  return s3Url.replace(
    /https:\/\/[^.]+\.s3\.[^.]+\.amazonaws\.com/,
    `https://${cdnDomain}`
  );
};

// Use in video component:
<video src={getCDNUrl(story.content_url)} />
```

## Monitoring & Debugging

### Check CloudFront Status

```bash
# AWS CLI
aws cloudfront get-distribution --id E1234ABCD
```

Look for:
- **Status**: `Deployed` (takes 10-15 minutes)
- **Enabled**: `true`
- **PriceClass**: Should be `PriceClass_All` for global coverage

### CloudFront Metrics

AWS Console → CloudFront → Distribution → Monitoring:
- **Requests**: Total API calls
- **Bytes Downloaded**: Data served
- **4xx/5xx Errors**: Failed requests
- **Cache Hit Ratio**: Should be > 80%

### Test from Different Regions

```bash
# macOS/Linux - Test from multiple locations
curl -w "\nTime: %{time_total}s\n" -o /dev/null -s https://d1234abcd.cloudfront.net/statuses/video-123.mp4

# For detailed info:
curl -i https://d1234abcd.cloudfront.net/statuses/video-123.mp4 | head -20
# Look for: X-Cache, X-Amz-Cf-Pop (edge location)
```

## Troubleshooting

### Distribution Not Deployed Yet
```
Error: "The CloudFront distribution is still being deployed"
```
**Solution**: Wait 10-15 minutes, then retry.

### 403 Forbidden from CloudFront
```
Error: "Access Denied"
```
**Solution**: 
1. Verify bucket is public or has correct origin access identity
2. Check CORS configuration applied (already done)
3. Verify S3 bucket policy allows GetObject

### Cache Not Working
```
Header: X-Cache: Miss from cloudfront
```
**Solution**:
1. Check cache headers returned by S3
2. Verify path patterns match in distribution config
3. Clear cache: CloudFront → Distribution → Invalidations

### Speed Not Improved
1. Check `X-Amz-Cf-Pop` header - should be edge location near user
2. Verify video is being served from correct distribution
3. Check video file size - if > 100MB, compress first
4. Test from different location (use speedtest.net)

## Cost Savings

### Bandwidth Cost Comparison (1GB/day average)

**S3 Only (30 days):**
- Data transfer: 30GB × $0.09 = **$2.70**
- Storage: < $1
- **Total: ~$3.70**

**With CloudFront (30 days):**
- Data transfer from CF: 30GB × $0.02 = **$0.60**
- S3 Origin Shield: ~$0.50
- **Total: ~$1.10**

**Monthly Savings: $2.60** (and 5-10x faster!)

## Production Checklist

- [ ] CloudFront distribution deployed (status = "Deployed")
- [ ] `NEXT_PUBLIC_CDN_URL` added to `.env`
- [ ] Video URLs use CloudFront domain
- [ ] Tested from multiple regions
- [ ] Cache hit ratio > 80%
- [ ] SSL certificate valid (check headers)
- [ ] Custom domain configured (optional)
- [ ] DNS CNAME record updated (if using custom domain)
- [ ] Monitoring alerts set up (optional)

## Rollback (if needed)

If CloudFront has issues, videos still work via S3:
1. Remove `NEXT_PUBLIC_CDN_URL` from `.env`
2. App automatically falls back to S3
3. No code changes needed! 🎉

## Next Steps

1. Run: `node scripts/setup-cloudfront-cdn.js`
2. Wait 10-15 minutes for deployment
3. Update `.env` with CloudFront domain
4. Test video playback
5. Monitor cache hit ratio

🚀 You should see 5-10x speed improvement globally!
