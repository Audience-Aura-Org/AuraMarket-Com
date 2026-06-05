# AuraDime Status Media Lifecycle

Status and story media is temporary. New uploads for status/story media are normalized to the S3 prefix:

```text
statuses/
```

The lifecycle rule deletes objects under that prefix after 3 days and aborts incomplete multipart uploads after 1 day.

## Apply on EC2

Run this from the backend folder after pulling the latest code:

```bash
cd /home/ec2-user/aura-market/backend
npm install
npm run s3:apply-status-lifecycle
pm2 restart aura-backend --update-env
```

The script preserves existing lifecycle rules and only upserts:

```text
auradime-delete-status-media-after-3-days
```

## Important

Only status/story media should use `statuses/`.

Do not place product images, store logos, banners, invoices, KYC files, order evidence, or dispute evidence under this prefix because S3 will delete them automatically.

## Current Free Cost Controls

- Status videos are limited to 30MB and 30 seconds in the web/app creator.
- Status images are limited to 8MB.
- Backend rejects oversized direct-upload requests for status media, even if the UI is bypassed.
- Status videos use the API upload path first so the backend can compress them to mobile-friendly MP4 before storing in S3.
- Story viewers only preload the next video metadata instead of several full videos.
- Shared image rendering uses native browser lazy loading unless explicitly marked high priority.
