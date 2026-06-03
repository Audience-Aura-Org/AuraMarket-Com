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

## Redis-backed shared state

Set Redis before running more than one PM2 worker or more than one EC2 instance:

```text
REDIS_URL=redis://your-redis-host:6379
REDIS_TLS=false
REDIS_CACHE_ENABLED=true
REDIS_RATE_LIMIT_ENABLED=true
REDIS_SOCKET_ENABLED=true
API_CACHE_TTL_SECONDS=60
SOCKET_TRANSPORTS=websocket,polling
```

With `REDIS_URL` enabled, Auradime shares:

- Public API response cache
- API rate-limit counters
- Socket.IO room broadcasts for chat, wallet, order, and notification events

Without `REDIS_URL`, the backend falls back to in-process memory so the current single-server startup keeps working.

If you are using a small Upstash plan, avoid heavy load tests against Redis-backed rate limits. Either upgrade the Redis plan or temporarily use memory rate limits:

```text
REDIS_RATE_LIMIT_ENABLED=false
API_RATE_LIMIT_MAX=100000
PUBLIC_RATE_LIMIT_MAX=100000
STRICT_RATE_LIMIT_MAX=5000
```

Keep `REDIS_SOCKET_ENABLED=true` for multi-worker Socket.IO rooms. Keep `REDIS_CACHE_ENABLED=true` only when the Redis plan can absorb the request volume.

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

For WebSockets behind an ALB, enable target-group stickiness. If you want to avoid sticky-session pressure entirely, run:

```text
SOCKET_TRANSPORTS=websocket
```

## Caching

Public GET routes now use short TTL API caching:

- `/api/v1/products`
- `/api/v1/vendors`
- `/api/v1/homepage`
- `/api/v1/categories`
- `/api/v1/discovery`
- `/api/v1/legal`

Private routes such as admin, wallet, cart, orders, chat, and authenticated vendor dashboards are not cached.

Useful environment variables:

```text
API_CACHE_TTL_SECONDS=60
API_CACHE_REDIS_PREFIX=auradime:api-cache:
```

When Redis is configured, cached public responses are shared across all PM2 workers and EC2 instances.

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

## MongoDB pool and indexes

Useful environment variables:

```text
MONGODB_MAX_POOL_SIZE=25
MONGODB_MIN_POOL_SIZE=2
MONGODB_MAX_IDLE_MS=60000
```

Auradime now defines compound indexes for the most common production reads:

- product discovery by status, category, featured, vendor, and popularity
- vendor/customer order timelines and payment states
- admin transaction ledgers by user, gateway, status, order, and date
- status/story feeds by expiry, category, vendor, and date
- shipment queues by vendor/logistics company and status
- review lookups by product and order

After deploy, MongoDB builds these indexes in the background. Watch Atlas metrics for slow queries and add more narrow indexes only when the profiler shows a real repeated query shape.
