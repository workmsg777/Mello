import 'dotenv/config';
import { app } from './app';
import { requireJwtSecret, requireOtpHashSecret } from './config/auth';
import {
  connectDatabase,
  disconnectDatabase,
  sequelize,
} from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { initializeModels } from './models';
import { createServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from './config/redis';
import { createChatServer } from './realtime/chat-server';
import {
  createNotificationGateway,
  notificationChannel,
} from './notifications/gateway';
import { startNotificationWorker } from './notifications/worker';

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  requireJwtSecret();
  requireOtpHashSecret();
  initializeModels(sequelize);
  await Promise.all([connectDatabase(), connectRedis()]);

  const server = createServer(app);
  const io = createChatServer(server);
  const pub = redis.duplicate(),
    sub = redis.duplicate();
  await Promise.all([pub.connect(), sub.connect()]);
  io.adapter(createAdapter(pub, sub, { key: 'mello:chat' }));
  const deliverNotifications = createNotificationGateway(io);
  const notificationSub = redis.duplicate();
  await notificationSub.connect();
  notificationSub.on('message', (channel, payload) => {
    if (channel !== notificationChannel) return;
    try {
      const ids: unknown = JSON.parse(payload);
      if (
        Array.isArray(ids) &&
        ids.length <= 100 &&
        ids.every((id) => typeof id === 'string')
      )
        deliverNotifications(ids);
    } catch {
      console.error('Invalid notification invalidation ignored.');
    }
  });
  await notificationSub.subscribe(notificationChannel);
  const stopNotifications =
    process.env.NOTIFICATION_WORKER_ENABLED === 'false'
      ? async () => {}
      : startNotificationWorker();
  server.listen(port, () => {
    console.log(`Mello API listening on port ${port}`);
  });

  const shutdown = (): void => {
    io.close(() => {
      void stopNotifications()
        .then(() =>
          Promise.allSettled([
            notificationSub.quit(),
            pub.quit(),
            sub.quit(),
            disconnectDatabase(),
            disconnectRedis(),
          ]),
        )
        .finally(() => process.exit(0));
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void start().catch((error: unknown) => {
  console.error(
    'Failed to start Mello API:',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exit(1);
});
