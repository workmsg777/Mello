// Explicit opt-in verification against a brand-new local PostgreSQL cluster.
// Never reads DATABASE_URL or touches an existing PostgreSQL server/database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

async function main() {
  const executable = (name) =>
    path.join(
      process.env.PG_BIN || 'C:/Program Files/PostgreSQL/18/bin',
      process.platform === 'win32' ? `${name}.exe` : name,
    );
  if (!fs.existsSync(executable('initdb')))
    throw new Error(
      'Set PG_BIN to the directory containing local initdb and pg_ctl executables',
    );
  const cacheRoot = path.resolve(__dirname, '../.cache');
  fs.mkdirSync(cacheRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(cacheRoot, 'native-postgres-'));
  const data = path.join(root, 'data');
  // Detached postgres must not retain Node's captured stdout/stderr pipes on Windows.
  const run = (name, args) =>
    execFileSync(executable(name), args, {
      windowsHide: true,
      stdio: 'ignore',
      timeout: 60000,
    });
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  let started = false,
    sequelize;
  try {
    console.log('Initializing an isolated local PostgreSQL cluster...');
    run('initdb', [
      '-D',
      data,
      '-U',
      'mello_test',
      '-A',
      'trust',
      '--encoding=UTF8',
      '--no-locale',
    ]);
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      path.join(root, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port} -c max_connections=40`,
      '-w',
      'start',
    ]);
    started = true;
    console.log('Applying migrations to isolated PostgreSQL...');
    process.env.DATABASE_URL = `postgres://mello_test@127.0.0.1:${port}/postgres`;
    process.env.NODE_ENV = 'test';
    process.env.MATCHING_MODE = 'RULES';
    ({ sequelize } = require('../src/config/database.ts'));
    sequelize.options.pool.max = 20;
    const { DataTypes, QueryTypes } = require('sequelize');
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    for (const file of fs
      .readdirSync(path.join(__dirname, '../database/migrations'))
      .sort())
      await require(`../database/migrations/${file}`).up(qi, DataTypes);
    for (const file of fs
      .readdirSync(path.join(__dirname, '../database/seeders'))
      .sort())
      await require(`../database/seeders/${file}`).up(qi, DataTypes);
    require('../src/models/index.ts').initializeModels(sequelize);
    console.log('Creating fictional test profiles...');
    const { seedDemoData, stableId } = require('./seed-demo.cjs');
    await seedDemoData(sequelize, {
      city: 'Chandigarh',
      uploadDirectory: path.join(root, 'photos'),
    });
    const query = (sql, replacements = {}) =>
      sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
    const {
      DiscoveryService,
    } = require('../src/services/discovery.service.ts');
    const { ChatService } = require('../src/services/chat.service.ts');
    const discovery = new DiscoveryService(),
      chat = new ChatService();
    const first = stableId('user', 'Rohan'),
      second = stableId('user', 'Anaya');
    const upgrade = require('../database/migrations/20261121000100-reciprocal-matching.js');
    // Round-trip the migration against populated fixtures before exercising v2 writes.
    await upgrade.down(qi);
    await query(
      "DELETE FROM user_profile_visibility WHERE user_id=:first AND field_code='DATING_INTENTION'",
      { first },
    );
    await query(
      "UPDATE user_profile_visibility SET visibility='PRIVATE' WHERE user_id=:second AND field_code='DATING_INTENTION'",
      { second },
    );
    await upgrade.up(qi);
    const rules = await query(
      "SELECT user_id,visibility FROM user_profile_visibility WHERE user_id IN (:ids) AND field_code='DATING_INTENTION'",
      { ids: [first, second] },
    );
    assert.equal(
      rules.find((r) => r.user_id === first).visibility,
      'MATCHING_ONLY',
    );
    assert.equal(rules.find((r) => r.user_id === second).visibility, 'PRIVATE');
    console.log('Exercising concurrent likes and messages...');
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        discovery.act(i % 2 ? first : second, i % 2 ? second : first, 'LIKE'),
      ),
    );
    const matchIds = new Set(
      results.filter((r) => r.matched).map((r) => r.matchId),
    );
    assert.equal(matchIds.size, 1);
    const [matchId] = [...matchIds];
    const [matches] = await query('SELECT count(*)::int AS total FROM matches');
    assert.equal(matches.total, 1);
    const [actions] = await query(
      "SELECT count(*)::int AS total FROM discovery_actions WHERE source='USER' AND action='LIKE'",
    );
    assert.equal(actions.total, 2);
    const [alerts] = await query(
      'SELECT count(*)::int AS total FROM notifications WHERE event_key=:key',
      { key: `match:${matchId}` },
    );
    assert.equal(alerts.total, 2);
    const inputs = Array.from({ length: 20 }, (_, i) => ({
      userId: i % 2 ? first : second,
      matchId,
      clientMessageId: randomUUID(),
      body: `Concurrent test ${i}`,
    }));
    const messages = await Promise.all(
      inputs.map(({ userId, ...input }) => chat.send(userId, input)),
    );
    assert.deepEqual(
      messages.map((r) => r.message.sequence).sort((a, b) => a - b),
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    const retries = await Promise.all(
      inputs.map(({ userId, ...input }) => chat.send(userId, input)),
    );
    assert.ok(retries.every((r) => r.duplicate));
    assert.equal(
      (await query('SELECT count(*)::int AS total FROM chat_messages'))[0]
        .total,
      20,
    );
    const last = messages.find((r) => r.message.sequence === 20).message;
    const earlier = messages.find((r) => r.message.sequence === 10).message;
    await Promise.all([
      chat.read(first, { matchId, messageId: last.id }),
      chat.read(first, { matchId, messageId: earlier.id }),
    ]);
    assert.equal(
      (
        await query(
          'SELECT last_read_sequence AS sequence FROM chat_reads WHERE match_id=:matchId AND user_id=:userId',
          { matchId, userId: first },
        )
      )[0].sequence,
      20,
    );
    // The outbox and business write must both roll back on an originating failure.
    const {
      NotificationService,
    } = require('../src/notifications/notification.service.ts');
    const original = NotificationService.prototype.users;
    const actor = stableId('user', 'Kabir'),
      target = stableId('user', 'Ishita');
    try {
      NotificationService.prototype.users = async () => {
        throw new Error('Injected rollback check');
      };
      await assert.rejects(
        discovery.act(actor, target, 'LIKE'),
        /Injected rollback check/,
      );
    } finally {
      NotificationService.prototype.users = original;
    }
    assert.equal(
      (
        await query(
          'SELECT count(*)::int AS total FROM discovery_actions WHERE actor_id=:actor AND target_id=:target',
          { actor, target },
        )
      )[0].total,
      0,
    );
    await Promise.all([
      discovery.exclude(first, second),
      discovery.exclude(first, second),
    ]);
    assert.equal(
      (
        await query('SELECT count(*)::int AS total FROM discovery_exclusions')
      )[0].total,
      1,
    );
    await assert.rejects(
      chat.send(second, {
        matchId,
        clientMessageId: randomUUID(),
        body: 'after hide',
      }),
      /not found/i,
    );
    console.log(
      'PASS: migration backfill, reciprocal exclusion, real PostgreSQL reciprocal-like concurrency, canonical match/outbox deduplication, ordered concurrent chat, idempotent retries, monotonic receipts and atomic rollback.',
    );
  } finally {
    if (sequelize) await sequelize.close();
    let stopped = true;
    if (started || fs.existsSync(path.join(data, 'postmaster.pid'))) {
      try {
        run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
      } catch {
        stopped = false;
        console.error(
          'Temporary PostgreSQL shutdown did not complete normally',
        );
      }
    }
    // Delete only the directory this invocation created, after checking its resolved boundary.
    const resolved = fs.realpathSync(root),
      allowed = fs.realpathSync(cacheRoot);
    assert.equal(path.dirname(resolved), allowed);
    assert.ok(path.basename(resolved).startsWith('native-postgres-'));
    try {
      if (stopped) fs.rmSync(resolved, { recursive: true, force: true });
    } catch {
      console.error(
        `Temporary cluster cleanup requires a later retry: ${root}`,
      );
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
