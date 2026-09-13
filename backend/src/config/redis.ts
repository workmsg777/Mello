import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
  },
);

redis.on('error', (error: Error) => {
  console.error('Redis connection error:', error.message);
});

export async function connectRedis(): Promise<void> {
  if (redis.status === 'wait') await redis.connect();
  await redis.ping();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.status === 'end') return;
  await redis.quit();
}
