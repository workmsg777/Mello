// Run only against a staging environment with disposable authenticated test accounts.
// This script does not create accounts, send SMS, or inject production notifications.
const fs = require('node:fs');
const { io } = require('socket.io-client');
const { performance } = require('node:perf_hooks');
async function run() {
  if (!process.argv.includes('--confirm-staging'))
    throw new Error('Pass --confirm-staging after selecting a staging target.');
  const target = process.env.NOTIFICATION_LOAD_URL;
  const filename = process.env.NOTIFICATION_LOAD_TOKENS_FILE;
  if (!target || !filename)
    throw new Error(
      'Set NOTIFICATION_LOAD_URL and NOTIFICATION_LOAD_TOKENS_FILE.',
    );
  const accounts = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (
    !Array.isArray(accounts) ||
    !accounts.length ||
    accounts.some((x) => typeof x.token !== 'string')
  )
    throw new Error('Token file must contain [{token}] for staging accounts.');
  const clients = Math.min(
    accounts.length,
    Math.max(1, Number(process.env.NOTIFICATION_LOAD_CLIENTS || 100)),
  );
  const duration = Math.max(
    10,
    Number(process.env.NOTIFICATION_LOAD_SECONDS || 60),
  );
  const ramp = Math.max(
    1,
    Number(process.env.NOTIFICATION_LOAD_RAMP_PER_SECOND || 10),
  );
  const api = target.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
  const origin = api.replace(/\/api$/, '');
  const sockets = [],
    httpMs = [],
    eventAgeMs = [];
  const count = {
    connected: 0,
    connectErrors: 0,
    signals: 0,
    syncSuccess: 0,
    syncErrors: 0,
  };
  const started = Date.now();
  const sample = (array, value) => {
    if (array.length < 100000) array.push(value);
  };
  for (let index = 0; index < clients; index++) {
    const token = accounts[index].token;
    const socket = io(origin + '/notifications', {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
    });
    sockets.push(socket);
    let busy = false;
    const seen = new Set();
    socket.on('connect', () => count.connected++);
    socket.on('connect_error', () => count.connectErrors++);
    socket.on('notifications:changed', async () => {
      count.signals++;
      if (busy) return;
      busy = true;
      const start = performance.now();
      try {
        const response = await fetch(api + '/notifications', {
          headers: { Authorization: 'Bearer ' + token },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('SYNC_FAILED');
        const page = await response.json();
        count.syncSuccess++;
        sample(httpMs, performance.now() - start);
        for (const notification of page.items) {
          const created = Date.parse(notification.createdAt);
          if (!seen.has(notification.id) && created >= started)
            sample(eventAgeMs, Date.now() - created);
          seen.add(notification.id);
        }
        if (seen.size > 300) {
          const keep = [...seen].slice(-100);
          seen.clear();
          keep.forEach((id) => seen.add(id));
        }
      } catch {
        count.syncErrors++;
      } finally {
        busy = false;
      }
    });
    if ((index + 1) % ramp === 0)
      await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await new Promise((resolve) => setTimeout(resolve, duration * 1000));
  const active = sockets.filter((socket) => socket.connected).length;
  sockets.forEach((socket) => socket.disconnect());
  const stats = (samples) => {
    samples.sort((a, b) => a - b);
    return {
      samples: samples.length,
      p50: samples[Math.floor(samples.length * 0.5)] ?? null,
      p95: samples[Math.floor(samples.length * 0.95)] ?? null,
      p99: samples[Math.floor(samples.length * 0.99)] ?? null,
    };
  };
  console.log(
    JSON.stringify(
      {
        clients,
        active,
        ...count,
        syncMs: stats(httpMs),
        newEventAgeMs: stats(eventAgeMs),
      },
      null,
      2,
    ),
  );
  if (active !== clients || count.syncErrors || count.connectErrors)
    process.exitCode = 1;
}
run().catch(() => {
  console.error(
    'Notification load test failed. Check staging target and token-file configuration. No tokens are logged.',
  );
  process.exitCode = 1;
});
