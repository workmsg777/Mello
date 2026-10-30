import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { connectRedis, disconnectRedis } from '../config/redis';
import { startNotificationWorker } from './worker';
async function start() {
  await Promise.all([connectDatabase(), connectRedis()]);
  const stop = startNotificationWorker();
  console.log('Notification workers started.');
  const shutdown = () => {
    void stop()
      .then(() => Promise.all([disconnectDatabase(), disconnectRedis()]))
      .then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
void start().catch(() => {
  console.error('Notification worker failed to start.');
  process.exit(1);
});
