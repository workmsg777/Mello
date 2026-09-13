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

const port = Number(process.env.PORT ?? 3000);

async function start(): Promise<void> {
  requireJwtSecret();
  requireOtpHashSecret();
  initializeModels(sequelize);
  await Promise.all([connectDatabase(), connectRedis()]);

  const server = app.listen(port, () => {
    console.log(`Mello API listening on port ${port}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      void Promise.allSettled([
        disconnectDatabase(),
        disconnectRedis(),
      ]).finally(() => process.exit(0));
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
