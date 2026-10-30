// Local smoke test: disposable accounts only; never sends SMS or device push.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { io } = require('socket.io-client');
const { sequelize } = require('../dist/config/database');
const models = require('../dist/models');
const { TokenService } = require('../dist/services/auth/token.service');
const {
  NotificationService,
} = require('../dist/notifications/notification.service');
async function run() {
  if (process.env.NODE_ENV === 'production')
    throw Error('Local smoke test is not for production');
  models.initializeModels(sequelize);
  await sequelize.authenticate();
  const tokens = new TokenService(),
    service = new NotificationService(),
    accounts = [],
    sockets = [];
  const endpoint = `http://127.0.0.1:${process.env.PORT || 4000}`;
  const stats = [];
  try {
    for (const type of ['DATING_USER', 'PARTNER_USER']) {
      const account = await models.Account.create({
        accountType: type,
        status: 'ACTIVE',
      });
      accounts.push(account.id);
      const session = await models.UserSession.create({
        accountId: account.id,
        refreshTokenHash: tokens.hashRefreshToken(randomUUID()),
        platform: 'UNKNOWN',
        expiresAt: new Date(Date.now() + 60000),
      });
      const token = tokens.createAccessToken({
        accountId: account.id,
        accountType: type,
        sessionId: session.id,
      });
      const socket = io(endpoint + '/notifications', {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
      });
      sockets.push(socket);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error('Socket connect timeout')),
          8000,
        );
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once('connect_error', reject);
      });
      const key = `smoke:${randomUUID()}`;
      const start = performance.now();
      const delivered = new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error('Live notification timeout')),
          10000,
        );
        socket.on('notifications:changed', () => {
          void fetch(endpoint + '/api/notifications', {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(async (response) => {
              assert.equal(response.status, 200);
              const inbox = await response.json();
              if (inbox.items.some((n) => n.body === key)) {
                clearTimeout(timer);
                resolve();
              }
            })
            .catch(reject);
        });
      });
      await sequelize.transaction((transaction) =>
        service.enqueue(
          [account.id],
          {
            key,
            kind: type === 'DATING_USER' ? 'DATE_INVITED' : 'DATE_REQUEST',
            category: 'dates',
            title: 'Disposable live test',
            body: key,
            data: {},
          },
          transaction,
        ),
      );
      await delivered;
      stats.push({
        app: type,
        delivered: true,
        elapsedMs: Math.round(performance.now() - start),
      });
    }
    console.log(
      JSON.stringify({
        postgresOutboxRedisWebSocket: 'passed',
        results: stats,
      }),
    );
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    if (accounts.length)
      await sequelize.transaction(async (transaction) => {
        const replacements = { ids: accounts };
        for (const table of [
          'notification_jobs',
          'notifications',
          'notification_devices',
          'notification_preferences',
          'user_sessions',
        ])
          await sequelize.query(
            `DELETE FROM ${table} WHERE account_id IN (:ids)`,
            { replacements, transaction },
          );
        await sequelize.query('DELETE FROM accounts WHERE id IN (:ids)', {
          replacements,
          transaction,
        });
      });
    await sequelize.close();
  }
}
run().catch(() => {
  console.error(
    'Notification smoke test failed; inspect local service health.',
  );
  process.exitCode = 1;
});
