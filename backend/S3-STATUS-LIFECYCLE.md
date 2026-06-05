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
