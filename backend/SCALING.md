# Auradime Backend Scaling Notes

## Current EC2 vertical scaling

Use PM2 cluster mode so one EC2 instance can use all CPU cores:

```bash
cd /home/ec2-user/aura-market/backend
npm install
pm2 delete aura-backend
pm2 start ecosystem.config.js --update-env
pm2 save
```

To limit worker count:

```bash
WEB_CONCURRENCY=2 pm2 start ecosystem.config.js --update-env
```

## Future horizontal scaling

Put an AWS Application Load Balancer in front of two or more EC2 instances.

Recommended target group health check:

```text
Path: /api/health
Port: 5000
Protocol: HTTP
Success codes: 200
```

Keep `app.set('trust proxy', 1)` enabled in `server.js` so Express reads the real client IP from the load balancer.

## Caching

Public GET routes now use short TTL API caching:

- `/api/v1/products`
- `/api/v1/vendors`
- `/api/v1/homepage`
- `/api/v1/categories`
- `/api/v1/discovery`
- `/api/v1/legal`

Private routes such as admin, wallet, cart, orders, chat, and authenticated vendor dashboards are not cached.

Useful environment variable:

```text
API_CACHE_TTL_SECONDS=60
```

For multi-instance EC2, replace the in-process cache with Redis/ElastiCache so all instances share the same cache.

## Queues

Notifications now use in-process named queues for slow external channels:

- `push`
- `email`

Database notification records and socket emits still happen immediately. PWA push and email delivery run in the queue with retry/backoff, so checkout, order, chat, and admin actions do not wait on external providers.

Useful environment variables:

```text
JOB_QUEUE_CONCURRENCY=4
JOB_QUEUE_ATTEMPTS=3
JOB_QUEUE_BACKOFF_MS=1500
```

Admin queue status:

```text
GET /api/v1/admin/queues
```

For multi-instance EC2, replace the in-process queue with Redis-backed BullMQ or AWS SQS so jobs survive restarts and are shared across instances.
