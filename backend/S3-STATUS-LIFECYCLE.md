# AuraDime Status Media Lifecycle

Temporary media is stored under predictable S3 prefixes so AWS can clean it up automatically.

Status and story media uploads are normalized to:

```text
statuses/
```

## Managed lifecycle rules

```text
statuses/    delete after 3 days
temp/        delete after 1 day
logs/        delete after 30 days
chat-media/  delete after 180 days
```

All managed rules also abort incomplete multipart uploads after 1 day.

## Apply on EC2

Run this from the backend folder after pulling the latest code:

```bash
cd /home/ec2-user/aura-market/backend
npm install
npm run s3:apply-status-lifecycle
pm2 restart aura-backend --update-env
```

The script preserves existing lifecycle rules and only upserts AuraDime-managed rules.

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
