import Redis from 'ioredis';

// ─── Redis connection factory ─────────────────────────────────────────────────
// Returns null when REDIS_URL is not configured (graceful fallback to in-memory)

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

function createClient(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  client.on('error', (err) => {
    // Log but don't crash — EventEmitter fallback handles SSE in this case
    console.warn('[Redis] connection error:', err.message);
  });
  return client;
}

export function getPublisher(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!publisher) {
    publisher = createClient();
    publisher.connect().catch(() => { /* handled by error event */ });
  }
  return publisher;
}

export function getSubscriber(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!subscriber) {
    subscriber = createClient();
    subscriber.connect().catch(() => { /* handled by error event */ });
  }
  return subscriber;
}
