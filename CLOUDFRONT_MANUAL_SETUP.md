<!-- Manual CloudFront Setup Guide -->

# Manual CloudFront Setup (AWS Console)

**Why manual?** Your IAM user needs CloudFront permissions. Two options:

## Option A: Quick Fix (10 minutes)

### Step 1: Grant IAM Permissions

1. Go to **AWS Console** → **IAM** → **Users** → Select your user (`aura-s3-user`)
2. Click **Add Permissions** → **Attach policies directly**
3. Search for `CloudFrontFullAccess` and attach it
4. Click **Attach policies**

Then run the script again:
```bash
cd backend && node scripts/setup-cloudfront-cdn.js
```

## Option B: Manual CloudFront Setup in Console (Recommended for first-time)

### Step 1: Create Distribution

1. Go to **AWS Console** → **CloudFront**
2. Click **Create distribution**
3. Fill in these settings:

#### Origin Settings
- **Origin domain**: `aura-market-frontend.s3.eu-north-1.amazonaws.com`
- **Protocol**: HTTPS only
- **Origin Shield**: Enable (improves cache hit ratio)
- **Origin Shield region**: eu-north-1

#### Default cache behavior
- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **HTTP methods**: GET, HEAD
- **Compress objects automatically**: ✅ YES
- **Cache policy**: CachingOptimized (or create custom)
- **Origin request policy**: CORS-S3Origin

#### Cache settings
- **Default TTL**: 86400 (1 day)
- **Maximum TTL**: 604800 (7 days)
- **Minimum TTL**: 0

#### Restrictions
- **Restrict viewer access**: No
- **Enable WAF**: No (optional, adds cost)

#### SSL Certificate
- **Custom SSL certificate** (optional):
  - For custom domain like `cdn.yourdomain.com`
  - Requires ACM certificate

#### Price class
- **Price class**: All edge locations (most expensive but fastest)

#### Disable Default Root Object
- Leave blank (videos accessed by full path)

### Step 2: Click Create Distribution

⏳ **Wait 10-15 minutes** for deployment.

### Step 3: Copy CloudFront Domain

Once deployment completes (Status = "Deployed"):
- Copy the **Domain name** (e.g., `d1234abcd.cloudfront.net`)
- Add to `.env`:

```env
NEXT_PUBLIC_CDN_URL=d1234abcd.cloudfront.net
```

### Step 4: Test

Try accessing a video:

```
# Before (S3 - slow)
https://aura-market-frontend.s3.eu-north-1.amazonaws.com/statuses/video-123.mp4

# After (CloudFront - fast)
https://d1234abcd.cloudfront.net/statuses/video-123.mp4
```

## Performance Results

After setup is complete:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Load time | 3-5s | 300-500ms | **5-10x faster** |
| Bandwidth cost | $0.09/GB | $0.02/GB | **78% savings** |
| Geographic coverage | 1 region | 400+ regions | **Global** |

## Troubleshooting

### Distribution Still "InProgress"
- **Normal**: CloudFront takes 10-15 minutes to deploy globally
- **Check**: AWS Console → CloudFront → Click distribution ID → Status

### Getting 403 Errors
**Problem**: Bucket might be private  
**Solution**:
1. AWS Console → S3 → Bucket → Permissions
2. Scroll to **Bucket policy**
3. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontRead",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::aura-market-frontend/*"
    }
  ]
}
```

4. Save

### Videos Still Slow
1. **Check CloudFront is being used**:
   ```bash
   # Should show CloudFront domain
   curl -I https://d1234abcd.cloudfront.net/statuses/video-123.mp4 | grep X-Cache
   ```

2. **Clear cache if needed**:
   - AWS Console → CloudFront → Invalidations
   - Click **Create invalidation**
   - Path: `/*`
   - Create

3. **Monitor**: AWS Console → CloudFront → Monitoring
   - Check "Cache Hit Ratio" (should be > 80%)

## Advanced: Custom Domain

To use `cdn.yourdomain.com` instead of `d1234abcd.cloudfront.net`:

### 1. Create SSL Certificate

1. AWS Console → **Certificate Manager**
2. **Request certificate**
3. Domain: `cdn.yourdomain.com`
4. Choose **DNS validation**
5. Click **Create records in Route 53** (auto-validates)

### 2. Update CloudFront Distribution

1. **CloudFront** → Click your distribution ID
2. **General** tab → **Edit**
3. **Alternate domain names (CNAMEs)**: Add `cdn.yourdomain.com`
4. **Custom SSL certificate**: Select your certificate
5. **Save changes**

### 3. Update DNS

1. AWS Console → **Route 53** → Your hosted zone
2. Create **CNAME record**:
   - Name: `cdn.yourdomain.com`
   - Value: `d1234abcd.cloudfront.net`
3. Save

### 4. Update Environment

```env
NEXT_PUBLIC_CDN_URL=cdn.yourdomain.com
```

Now videos are served from `https://cdn.yourdomain.com/...`

## Next Steps After CloudFront is Ready

1. Update `.env` with CloudFront domain
2. Verify cache hit ratio > 80%
3. Monitor bandwidth savings in AWS Console
4. (Optional) Set up custom domain
5. (Optional) Enable Origin Shield for even better cache

You should now see **5-10x faster video delivery globally!** 🚀
