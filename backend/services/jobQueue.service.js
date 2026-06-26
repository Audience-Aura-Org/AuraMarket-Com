const DEFAULT_CONCURRENCY = Number(process.env.JOB_QUEUE_CONCURRENCY || 4);
const DEFAULT_ATTEMPTS = Number(process.env.JOB_QUEUE_ATTEMPTS || 3);
const DEFAULT_BACKOFF_MS = Number(process.env.JOB_QUEUE_BACKOFF_MS || 1500);

const queues = new Map();
let shuttingDown = false;

const getQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(name, {
      name,
      pending: [],
      active: 0,
      processed: 0,
      failed: 0,
    });
  }
  return queues.get(name);
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runJob = async (queue, job) => {
  queue.active += 1;
  try {
    await job.handler(job.payload);
    queue.processed += 1;
  } catch (error) {
    if (job.attempt < job.attempts) {
      const backoff = job.backoffMs * job.attempt;
      setTimeout(() => {
        queue.pending.push({ ...job, attempt: job.attempt + 1 });
        processQueue(queue.name);
      }, backoff).unref?.();
    } else {
      queue.failed += 1;
      console.error(`[Queue:${queue.name}] Job failed after ${job.attempts} attempts:`, error.message);
    }
  } finally {
    queue.active -= 1;
    processQueue(queue.name);
  }
};

const processQueue = (name) => {
  if (shuttingDown) return;
  const queue = getQueue(name);
  while (queue.active < DEFAULT_CONCURRENCY && queue.pending.length > 0) {
    const job = queue.pending.shift();
    runJob(queue, job);
  }
};

const enqueueJob = (name, handler, payload = {}, options = {}) => {
  if (shuttingDown) {
    console.warn(`[Queue:${name}] Rejecting job because shutdown is in progress.`);
    return null;
  }

  const queue = getQueue(name);
  const job = {
    id: `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    handler,
    payload,
    attempt: 1,
    attempts: Number(options.attempts || DEFAULT_ATTEMPTS),
    backoffMs: Number(options.backoffMs || DEFAULT_BACKOFF_MS),
  };

  queue.pending.push(job);
  processQueue(name);
  return job.id;
};

const getQueueStats = () => {
  const stats = {};
  for (const [name, queue] of queues.entries()) {
    stats[name] = {
      pending: queue.pending.length,
      active: queue.active,
      processed: queue.processed,
      failed: queue.failed,
    };
  }
  return stats;
};

const drainQueues = async ({ timeoutMs = 10000 } = {}) => {
  shuttingDown = true;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const busy = [...queues.values()].some((queue) => queue.active > 0);
    if (!busy) return true;
    await delay(250);
  }

  return false;
};

module.exports = {
  enqueueJob,
  getQueueStats,
  drainQueues,
};
