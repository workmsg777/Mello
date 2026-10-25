const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { PGLiteSocketServer } = require('@electric-sql/pglite-socket');
let db,
  socket,
  sequelize,
  models,
  base,
  server,
  a,
  b,
  outsider,
  draft,
  partner,
  partnerOther;
let api, query, matchId, venueId, planId, restaurantAccount;
let chatIo;

before(
  async () => {
    db = await PGlite.create();
    socket = new PGLiteSocketServer({
      db,
      host: '127.0.0.1',
      port: 0,
      maxConnections: 20,
    });
    await socket.start();
    process.env.DATABASE_URL = `postgres://postgres:postgres@${socket.getServerConn()}/postgres`;
    process.env.JWT_SECRET = 'integration-test-secret-only-not-for-production';
    process.env.OTP_HASH_SECRET = 'integration-test-otp-secret-only';
    process.env.NODE_ENV = 'test';
    ({ sequelize } = require('../src/config/database.ts'));
    // The embedded test runtime serializes transactions over one connection.
    sequelize.options.pool.max = 1;
    await sequelize.authenticate();
    const qi = sequelize.getQueryInterface();
    const { DataTypes, QueryTypes } = require('sequelize');
    // PGlite has one underlying session. Sequelize's enum OID refresh opens a
    // separate connection during DDL transactions; run test DDL in autocommit.
    // Application transactions below use the real Sequelize transaction method.
    const realTransaction = sequelize.transaction.bind(sequelize);
    sequelize.transaction = async (callback) => callback(undefined);
    for (const file of readdirSync(
      path.join(__dirname, '../database/migrations'),
    ).sort())
      await require(`../database/migrations/${file}`).up(qi, DataTypes);
    for (const file of readdirSync(
      path.join(__dirname, '../database/seeders'),
    ).sort())
      await require(`../database/seeders/${file}`).up(qi, DataTypes);
    sequelize.transaction = realTransaction;
    console.log(
      'All migrations and catalog seeds applied to embedded PostgreSQL.',
    );
    models = require('../src/models/index.ts');
    models.initializeModels(sequelize);
    query = async (sql, replacements = {}) =>
      sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
    const {
      AuthenticationRepository,
    } = require('../src/repositories/authentication.repository.ts');
    const { TokenService } = require('../src/services/auth/token.service.ts');
    const repository = new AuthenticationRepository(),
      tokens = new TokenService();
    let phone = 9000000000;
    const account = async (type = 'DATING_USER') => {
      let profile, session;
      await sequelize.transaction(async (transaction) => {
        profile = await repository.createAccount(
          {
            phone: `+91${phone++}`,
            accountType: type,
            ...(type === 'PARTNER_USER'
              ? {
                  partner: {
                    ownerName: 'Test Owner',
                    businessName: 'Test Little Cafe',
                    category: 'RESTAURANT',
                    addressLine1: '12 Test Street',
                    city: 'Bengaluru',
                    state: 'Karnataka',
                    postalCode: '560001',
                    countryCode: 'IN',
                  },
                }
              : {}),
          },
          transaction,
        );
        session = await repository.createSession(
          profile.account.id,
          tokens.hashRefreshToken(tokens.createRefreshToken()),
          new Date(Date.now() + 86400000),
          {},
          {},
          transaction,
        );
      });
      return {
        ...profile,
        token: tokens.createAccessToken({
          accountId: profile.account.id,
          accountType: type,
          sessionId: session.id,
        }),
        sessionId: session.id,
      };
    };
    a = await account();
    b = await account();
    outsider = await account();
    draft = await account();
    partner = await account('PARTNER_USER');
    partnerOther = await account('PARTNER_USER');
    restaurantAccount = account;
    const { app } = require('../src/app.ts');
    server = require('node:http').createServer(app);
    chatIo = require('../src/realtime/chat-server.ts').createChatServer(server);
    server.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
    api = async (who, method, url, body, expected = 200) => {
      const response = await fetch(base + url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(who ? { Authorization: `Bearer ${who.token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      assert.equal(
        response.status,
        expected,
        `${method} ${url}: ${JSON.stringify(result)}`,
      );
      return result;
    };
    const catalog = await api(a, 'GET', '/dating/catalog');
    const [city] = await query("SELECT id FROM cities WHERE name='Bengaluru'");
    const profile = async (who, name) => {
      await api(who, 'PUT', '/dating/profile', {
        displayName: name,
        dateOfBirth: '1999-01-01',
        bio: 'A thoughtful little test profile.',
        currentCityId: city.id,
      });
      await api(who, 'POST', '/dating/onboarding/start', {
        onboardingVersion: 1,
        firstStepId: catalog.onboardingSteps[0].id,
      });
      for (const category of catalog.profileOptionCategories.filter(
        (x) => x.isRequiredForOnboarding,
      )) {
        const choices = catalog.profileOptions
          .filter((x) => x.categoryId === category.id)
          .slice(0, Math.max(1, category.minSelections));
        await api(who, 'PUT', `/dating/profile-options/${category.id}`, {
          selections: choices.map((x, i) => ({
            optionId: x.id,
            isPrimary: i === 0,
            displayOrder: i,
          })),
        });
        await api(who, 'PUT', `/dating/visibility/${category.code}`, {
          visibility: category.isSensitive ? 'MATCHING_ONLY' : 'PROFILE',
        });
      }
      await api(who, 'PUT', '/dating/match-preferences', {
        minAge: 18,
        maxAge: 80,
        maxDistanceKm: 50,
      });
      await api(who, 'PUT', '/dating/interests', {
        selections: catalog.interests
          .slice(0, catalog.rules.minimumInterests)
          .map((x, i) => ({ interestId: x.id, displayOrder: i })),
      });
      for (let i = 0; i < catalog.rules.minimumPhotos; i++) {
        const media = await models.Media.create({
          uploadedByAccountId: who.account.id,
          storageProvider: 'LOCAL',
          storageKey: `test/${randomUUID()}.jpg`,
          url: '/uploads/profile-photos/test.jpg',
          mediaType: 'IMAGE',
          mimeType: 'image/jpeg',
          sizeBytes: '12',
        });
        await models.UserPhoto.create({
          userId: who.profile.userId,
          mediaId: media.id,
          displayOrder: i,
          isPrimary: i === 0,
          moderationStatus: 'PENDING',
        });
      }
      for (const code of catalog.consent.requiredCodes)
        await api(
          who,
          'POST',
          '/dating/consents',
          {
            consentCode: code,
            policyVersion: catalog.consent.policyVersion,
            status: 'GRANTED',
          },
          201,
        );
      for (const step of catalog.onboardingSteps)
        await api(who, 'POST', `/dating/onboarding/steps/${step.id}`, {
          onboardingVersion: 1,
          status: step.isRequired ? 'COMPLETED' : 'SKIPPED',
        });
      await api(who, 'POST', '/dating/onboarding/complete', {
        onboardingVersion: 1,
      });
    };
    await profile(a, 'Alex');
    await profile(b, 'Blair');
    await profile(outsider, 'Casey');
  },
  { timeout: 120000 },
);

after(async () => {
  if (chatIo) await new Promise((resolve) => chatIo.close(resolve));
  else if (server) await new Promise((resolve) => server.close(resolve));
  if (sequelize) await sequelize.close();
  if (socket) await socket.stop();
  if (db) await db.close();
});

test('authentication and completed onboarding gate discovery', async () => {
  await api(null, 'GET', '/discovery/feed', undefined, 401);
  await api(draft, 'GET', '/discovery/feed', undefined, 403);
  await api(partner, 'GET', '/discovery/feed', undefined, 403);
  const feed = await api(a, 'GET', '/discovery/feed');
  assert.ok(feed.profiles.some((x) => x.userId === b.profile.userId));
  assert.ok(
    !feed.profiles.some(
      (x) => x.userId === a.profile.userId || x.userId === draft.profile.userId,
    ),
  );
  const card = feed.profiles[0];
  assert.equal(card.compatibility.isDemo, true);
  assert.ok(
    card.compatibility.percentage >= 72 && card.compatibility.percentage <= 98,
  );
  assert.equal(card.profile.dateOfBirth, undefined);
  assert.equal(card.matchPreferences, undefined);
  assert.ok(
    !card.profileOptions.some((x) => x.categoryCode === 'GENDER_IDENTITY'),
  );
});
test('discovery honors reciprocal gender and age preferences and active account status', async () => {
  await api(a, 'PUT', '/dating/match-preferences', {
    minAge: 70,
    maxAge: 80,
    maxDistanceKm: 50,
    ageIsDealbreaker: true,
  });
  assert.ok(
    !(await api(a, 'GET', '/discovery/feed')).profiles.some(
      (x) => x.userId === b.profile.userId,
    ),
  );
  await api(a, 'PUT', '/dating/match-preferences', {
    minAge: 18,
    maxAge: 80,
    maxDistanceKm: 50,
    ageIsDealbreaker: true,
  });
  const catalog = await api(a, 'GET', '/dating/catalog');
  const category = catalog.profileOptionCategories.find(
    (x) => x.code === 'GENDER_IDENTITY',
  );
  const state = await api(b, 'GET', '/dating/state');
  const current = state.profileOptions
    .filter((x) => x.categoryId === category.id)
    .map((x) => x.optionId);
  const other = catalog.profileOptions.find(
    (x) => x.categoryId === category.id && !current.includes(x.id),
  );
  await api(a, 'PUT', `/dating/option-preferences/${category.id}`, {
    preferences: [{ optionId: other.id, isDealbreaker: false, priority: 3 }],
  });
  assert.ok(
    !(await api(a, 'GET', '/discovery/feed')).profiles.some(
      (x) => x.userId === b.profile.userId,
    ),
  );
  await api(a, 'PUT', `/dating/option-preferences/${category.id}`, {
    preferences: [],
  });
  await models.Account.update(
    { status: 'SUSPENDED' },
    { where: { id: b.account.id } },
  );
  assert.ok(
    !(await api(a, 'GET', '/discovery/feed')).profiles.some(
      (x) => x.userId === b.profile.userId,
    ),
  );
  await models.Account.update(
    { status: 'ACTIVE' },
    { where: { id: b.account.id } },
  );
  assert.ok(
    (await api(a, 'GET', '/discovery/feed')).profiles.some(
      (x) => x.userId === b.profile.userId,
    ),
  );
});
test('likes create one mutual match, are idempotent, and disappear from discovery', async () => {
  const first = await api(a, 'POST', '/discovery/actions', {
    targetId: b.profile.userId,
    action: 'LIKE',
  });
  assert.equal(first.matched, false);
  assert.equal(first.matchId, null);
  assert.equal((await api(a, 'GET', '/chat/conversations')).length, 0);
  const received = await api(b, 'GET', '/discovery/likes');
  assert.equal(received.total, 1);
  assert.equal(received.profiles[0].userId, a.profile.userId);
  assert.ok(received.profiles[0].likedAt);
  assert.equal(received.profiles[0].matchPreferences, undefined);
  assert.equal(received.profiles[0].profile.dateOfBirth, undefined);
  await api(outsider, 'POST', '/discovery/actions', {
    targetId: b.profile.userId,
    action: 'LIKE',
  });
  const pageOne = await api(b, 'GET', '/discovery/likes?limit=1');
  const pageTwo = await api(b, 'GET', '/discovery/likes?limit=1&offset=1');
  assert.equal(pageOne.total, 2);
  assert.equal(pageOne.nextOffset, 1);
  assert.equal(pageTwo.nextOffset, null);
  assert.notEqual(pageOne.profiles[0].userId, pageTwo.profiles[0].userId);
  await api(b, 'POST', '/discovery/actions', {
    targetId: outsider.profile.userId,
    action: 'PASS',
  });
  assert.equal((await api(a, 'GET', '/discovery/likes')).total, 0);
  await api(null, 'GET', '/discovery/likes', undefined, 401);
  await api(draft, 'GET', '/discovery/likes', undefined, 403);
  await api(partner, 'GET', '/discovery/likes', undefined, 403);
  await api(b, 'GET', '/discovery/likes?limit=999', undefined, 400);
  const second = await api(b, 'POST', '/discovery/actions', {
    targetId: a.profile.userId,
    action: 'LIKE',
  });
  assert.equal(second.matched, true);
  matchId = second.matchId;
  assert.equal((await api(b, 'GET', '/discovery/likes')).total, 0);
  const retry = await api(b, 'POST', '/discovery/actions', {
    targetId: a.profile.userId,
    action: 'LIKE',
  });
  assert.equal(retry.matchId, matchId);
  assert.equal((await api(a, 'GET', '/discovery/matches')).length, 1);
  assert.ok(
    !(await api(a, 'GET', '/discovery/feed')).profiles.some(
      (x) => x.userId === b.profile.userId,
    ),
  );
  await api(
    a,
    'POST',
    '/discovery/actions',
    { targetId: a.profile.userId, action: 'LIKE' },
    400,
  );
});

test('one-sided likes appear in Liked you; a stale match row cannot grant chat and Pass dismisses a like', async () => {
  const like = await api(outsider, 'POST', '/discovery/actions', {
    targetId: a.profile.userId,
    action: 'LIKE',
  });
  assert.equal(like.matched, false);
  const incoming = await api(a, 'GET', '/discovery/likes?limit=1');
  assert.equal(incoming.total, 1);
  assert.equal(incoming.profiles[0].userId, outsider.profile.userId);
  const fakeId = randomUUID();
  const [low, high] = [a.profile.userId, outsider.profile.userId].sort();
  await query(
    'INSERT INTO matches (id,user_low,user_high) VALUES (:id,:low,:high)',
    { id: fakeId, low, high },
  );
  await api(
    a,
    'POST',
    '/chat/' + fakeId + '/messages',
    { clientMessageId: randomUUID(), body: 'A row alone is insufficient' },
    404,
  );
  await api(a, 'GET', '/chat/' + fakeId + '/messages', undefined, 404);
  await api(
    a,
    'GET',
    '/discovery/matches/' + fakeId + '/plans',
    undefined,
    404,
  );
  assert.ok(
    !(await api(a, 'GET', '/discovery/matches')).some(
      (item) => item.id === fakeId,
    ),
  );
  assert.ok(
    !(await api(a, 'GET', '/chat/conversations')).some(
      (item) => item.matchId === fakeId,
    ),
  );
  assert.equal((await api(a, 'GET', '/discovery/likes')).total, 1);
  await api(a, 'POST', '/discovery/actions', {
    targetId: outsider.profile.userId,
    action: 'PASS',
  });
  assert.equal((await api(a, 'GET', '/discovery/likes')).total, 0);
  await query('DELETE FROM matches WHERE id=:id', { id: fakeId });
});

test('chat is match-only, persistent, ordered, idempotent and tracks unread/read state', async () => {
  await api(null, 'GET', '/chat/conversations', undefined, 401);
  await api(partner, 'GET', '/chat/conversations', undefined, 403);
  await api(draft, 'GET', '/chat/conversations', undefined, 403);
  await api(outsider, 'GET', '/chat/' + matchId + '/messages', undefined, 404);
  const payload = {
    clientMessageId: randomUUID(),
    body: 'Hello Blair! Coffee or a long walk?',
  };
  await api(outsider, 'POST', '/chat/' + matchId + '/messages', payload, 404);
  const message = await api(
    a,
    'POST',
    '/chat/' + matchId + '/messages',
    payload,
    201,
  );
  assert.equal(message.senderId, a.profile.userId);
  assert.equal(message.sequence, 1);
  const duplicate = await api(
    a,
    'POST',
    '/chat/' + matchId + '/messages',
    payload,
  );
  assert.equal(duplicate.id, message.id);
  await api(
    a,
    'POST',
    '/chat/' + matchId + '/messages',
    { ...payload, body: 'Changed body' },
    409,
  );
  await api(
    a,
    'POST',
    '/chat/' + matchId + '/messages',
    { clientMessageId: randomUUID(), body: '   ' },
    400,
  );
  await api(
    a,
    'POST',
    '/chat/' + matchId + '/messages',
    { clientMessageId: randomUUID(), body: 'x'.repeat(2001) },
    400,
  );
  const summary = (await api(b, 'GET', '/chat/conversations')).find(
    (x) => x.matchId === matchId,
  );
  assert.equal(summary.unreadCount, 1);
  assert.equal(summary.lastMessage.id, message.id);
  const receipt = await api(b, 'POST', '/chat/' + matchId + '/read', {
    messageId: message.id,
  });
  assert.equal(receipt.lastReadSequence, 1);
  assert.equal((await api(b, 'GET', '/chat/conversations'))[0].unreadCount, 0);
  assert.equal(
    (await api(a, 'GET', '/chat/' + matchId + '/messages')).peerReadSequence,
    1,
  );
  await api(
    outsider,
    'POST',
    '/chat/' + matchId + '/read',
    { messageId: message.id },
    404,
  );
  await api(
    a,
    'POST',
    '/chat/' + matchId + '/read',
    { messageId: randomUUID() },
    404,
  );
});

test('real WebSockets deliver messages, typing and read receipts only to participants', async (t) => {
  const { io } = require('socket.io-client');
  const connect = async (who) => {
    const client = io(base.replace('/api', ''), {
      transports: ['websocket'],
      auth: { token: who.token },
      forceNew: true,
      reconnection: false,
    });
    t.after(() => client.disconnect());
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  };
  const left = await connect(a),
    right = await connect(b),
    other = await connect(outsider);
  const once = (socket, event) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out: ' + event)),
        4000,
      );
      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  let leaked = false;
  other.on('chat:message', () => {
    leaked = true;
  });
  const forbidden = await other.timeout(4000).emitWithAck('chat:send', {
    matchId,
    clientMessageId: randomUUID(),
    body: 'Not a match',
  });
  assert.equal(forbidden.status, 404);
  const received = once(right, 'chat:message');
  const input = {
    matchId,
    clientMessageId: randomUUID(),
    body: 'A real-time hello ♡',
  };
  const sent = await left.timeout(4000).emitWithAck('chat:send', input);
  assert.equal(sent.ok, true);
  assert.equal((await received).id, sent.data.id);
  const retry = await left.timeout(4000).emitWithAck('chat:send', input);
  assert.equal(retry.data.id, sent.data.id);
  assert.equal(retry.data.sequence, sent.data.sequence);
  const typing = once(right, 'chat:typing');
  assert.equal(
    (
      await left
        .timeout(4000)
        .emitWithAck('chat:typing', { matchId, typing: true })
    ).ok,
    true,
  );
  assert.equal((await typing).userId, a.profile.userId);
  const read = once(left, 'chat:read');
  assert.equal(
    (
      await right
        .timeout(4000)
        .emitWithAck('chat:read', { matchId, messageId: sent.data.id })
    ).ok,
    true,
  );
  assert.equal((await read).lastReadSequence, sent.data.sequence);
  const forbiddenTyping = await other
    .timeout(4000)
    .emitWithAck('chat:typing', { matchId, typing: true });
  assert.equal(forbiddenTyping.status, 404);
  right.disconnect();
  const missed = await left.timeout(4000).emitWithAck('chat:send', {
    matchId,
    clientMessageId: randomUUID(),
    body: 'Saved while you were offline',
  });
  assert.equal(missed.ok, true);
  const reconnected = await connect(b);
  assert.equal(reconnected.connected, true);
  const history = await api(b, 'GET', '/chat/' + matchId + '/messages');
  assert.ok(history.messages.some((x) => x.id === missed.data.id));
  const rewind = await api(b, 'POST', '/chat/' + matchId + '/read', {
    messageId: history.messages[0].id,
  });
  assert.ok(rewind.lastReadSequence >= sent.data.sequence);
  assert.equal(leaked, false);
  // Session revocation is checked on every packet, rather than trusting the handshake forever.
  await models.UserSession.update(
    { revokedAt: new Date() },
    { where: { id: outsider.sessionId } },
  );
  const revoked = await other.timeout(4000).emitWithAck('chat:send', {
    matchId,
    clientMessageId: randomUUID(),
    body: 'Revoked',
  });
  assert.equal(revoked.status, 401);
  await models.UserSession.update(
    { revokedAt: null },
    { where: { id: outsider.sessionId } },
  );
});

test('chat history uses gap-free cursor pages and enforces a cross-transport send limit', async () => {
  // Historical fixtures exercise pagination without artificially sending 50 live messages per minute.
  for (let i = 0; i < 55; i++) {
    const [position] = await query(
      'UPDATE matches SET chat_sequence=chat_sequence+1 WHERE id=:matchId RETURNING chat_sequence',
      { matchId },
    );
    await query(
      "INSERT INTO chat_messages (id,match_id,sender_id,client_message_id,sequence,body,created_at) VALUES (:id,:matchId,:sender,:client,:sequence,:body,now()-interval '2 minutes')",
      {
        id: randomUUID(),
        matchId,
        sender: b.profile.userId,
        client: randomUUID(),
        sequence: position.chat_sequence,
        body: 'Earlier message ' + i,
      },
    );
  }
  const first = await api(a, 'GET', '/chat/' + matchId + '/messages');
  assert.equal(first.messages.length, 50);
  assert.ok(first.nextBefore);
  const older = await api(
    a,
    'GET',
    '/chat/' + matchId + '/messages?before=' + first.nextBefore,
  );
  assert.ok(
    older.messages.every((x) => x.sequence < first.messages[0].sequence),
  );
  const [total] = await query(
    'SELECT count(*)::int AS n FROM chat_messages WHERE match_id=:matchId',
    { matchId },
  );
  assert.equal(
    new Set([...older.messages, ...first.messages].map((x) => x.id)).size,
    total.n,
  );
  const [position] = await query(
    'SELECT chat_sequence FROM matches WHERE id=:matchId',
    { matchId },
  );
  for (let i = 0; i < 30; i++)
    await query(
      'INSERT INTO chat_messages (id,match_id,sender_id,client_message_id,sequence,body) VALUES (:id,:matchId,:sender,:client,:sequence,:body)',
      {
        id: randomUUID(),
        matchId,
        sender: b.profile.userId,
        client: randomUUID(),
        sequence: position.chat_sequence + i + 1,
        body: 'Rate fixture',
      },
    );
  await query(
    'UPDATE matches SET chat_sequence=chat_sequence+30 WHERE id=:matchId',
    { matchId },
  );
  await api(
    b,
    'POST',
    '/chat/' + matchId + '/messages',
    { clientMessageId: randomUUID(), body: 'Too fast' },
    429,
  );
});

test('partners publish cafés, restaurants and activities with ownership enforcement', async () => {
  await api(a, 'GET', '/partner/workspace', undefined, 403);
  const workspace = await api(partner, 'GET', '/partner/workspace');
  venueId = workspace.venue.id;
  const input = {
    name: 'The Test Cafe',
    description: 'Quiet corners for two.',
    address: '12 Test Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    kind: 'RESTAURANT',
    headline: 'A lovely table for two',
    imageUrl: null,
    priceForTwoInr: 900,
    durationMinutes: 90,
    tags: ['Quiet corners'],
    isPublished: false,
    latitude: 12.97,
    longitude: 77.59,
  };
  await api(partner, 'PUT', '/partner/listing', input);
  assert.equal((await api(a, 'GET', '/discovery/venues')).venues.length, 0);
  await api(partner, 'PUT', '/partner/listing', {
    ...input,
    isPublished: true,
  });
  const venues = await api(a, 'GET', '/discovery/venues?kind=RESTAURANT');
  assert.equal(venues.venues.length, 1);
  assert.equal(venues.venues[0].id, venueId);
  assert.equal(
    (await api(a, 'GET', '/discovery/venues?kind=ACTIVITY')).venues.length,
    0,
  );
  await api(
    partner,
    'PUT',
    '/partner/listing',
    { ...input, imageUrl: 'http://unsafe.example/photo.jpg' },
    400,
  );
});
test('only matched people can propose, accept or cancel dates; only venue owners can confirm', async () => {
  const proposedAt = new Date(Date.now() + 2 * 86400000).toISOString();
  await api(
    outsider,
    'POST',
    `/discovery/matches/${matchId}/plans`,
    { partnerId: venueId, proposedAt, note: 'Hi' },
    404,
  );
  const plan = await api(
    a,
    'POST',
    `/discovery/matches/${matchId}/plans`,
    { partnerId: venueId, proposedAt, note: 'Coffee and a walk?' },
    201,
  );
  planId = plan.id;
  assert.equal((await api(partner, 'GET', '/partner/requests')).length, 0);
  await api(
    a,
    'PATCH',
    `/discovery/matches/${matchId}/plans/${planId}`,
    { status: 'ACCEPTED' },
    409,
  );
  await api(b, 'PATCH', `/discovery/matches/${matchId}/plans/${planId}`, {
    status: 'ACCEPTED',
  });
  await api(
    partnerOther,
    'PATCH',
    `/partner/requests/${planId}`,
    { status: 'CONFIRMED' },
    409,
  );
  const inbox = await api(partner, 'GET', '/partner/requests');
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].creatorUserId, undefined);
  await api(partner, 'PATCH', `/partner/requests/${planId}`, {
    status: 'CONFIRMED',
  });
  assert.equal(
    (await api(b, 'GET', `/discovery/matches/${matchId}/plans`))[0]
      .partnerStatus,
    'CONFIRMED',
  );
  await api(b, 'PATCH', `/discovery/matches/${matchId}/plans/${planId}`, {
    status: 'CANCELLED',
  });
  await api(
    partner,
    'PATCH',
    `/partner/requests/${planId}`,
    { status: 'CONFIRMED' },
    409,
  );
});
test('invalid dates and identifiers are rejected', async () => {
  await api(
    a,
    'POST',
    `/discovery/matches/${matchId}/plans`,
    { partnerId: venueId, proposedAt: '2000-01-01T00:00:00Z' },
    400,
  );
  await api(a, 'GET', '/discovery/matches/not-an-id/plans', undefined, 400);
  await api(a, 'GET', '/discovery/feed?limit=999', undefined, 400);
});
test('revoked access sessions cannot call protected routes', async () => {
  await models.UserSession.update(
    { revokedAt: new Date() },
    { where: { id: outsider.sessionId } },
  );
  await api(outsider, 'GET', '/discovery/feed', undefined, 401);
});
test('photo ordering remains unique after a middle photo is removed', async () => {
  const {
    UserPhotoService,
  } = require('../src/services/dating/photo.service.ts');
  const service = new UserPhotoService();
  const photos = await service.list(a.profile.userId);
  await service.remove(a.profile.userId, photos[1].id);
  await service.upload(a.profile.userId, a.account.id, {
    path: 'test-unused',
    filename: `test-${randomUUID()}.jpg`,
    mimetype: 'image/jpeg',
    size: 12,
  });
  const after = await service.list(a.profile.userId);
  assert.equal(after.length, 3);
  assert.equal(new Set(after.map((x) => x.displayOrder)).size, 3);
});

test('browser photo upload reaches the authenticated route as a real file', async (t) => {
  const {
    createPhotoFormData,
  } = require('../../frontend/src/services/photo-upload.ts');
  const { profilePhotoUploadDirectory } = require('../src/config/uploads.ts');
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=',
    'base64',
  );
  const form = await createPhotoFormData(
    {
      uri: 'blob:unused',
      file: new File([bytes], 'portrait.png', { type: 'image/png' }),
    },
    'web',
  );
  const response = await fetch(`${base}/dating/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${draft.token}` },
    body: form,
  });
  assert.equal(response.status, 201);
  const photo = (await response.json()).photos[0];
  assert.equal(photo.mimeType, 'image/png');
  const filename = path.basename(photo.url);
  assert.match(filename, /^[0-9a-f-]+\.png$/);
  t.after(() =>
    require('node:fs/promises').unlink(
      path.join(profilePhotoUploadDirectory, filename),
    ),
  );
  const uploaded = await fetch(new URL(photo.url, base));
  assert.equal(uploaded.status, 200);
  assert.equal(
    uploaded.headers.get('Cross-Origin-Resource-Policy'),
    'cross-origin',
  );
  assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), bytes);
  assert.ok(
    (await api(draft, 'GET', '/dating/photos')).photos.some(
      (item) => item.id === photo.id,
    ),
  );
});

test('demo seed creates 22 adult profiles with photos and is safe to rerun', async (t) => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const {
    seedDemoData,
    DEMO_PROFILES,
    stableId,
  } = require('../scripts/seed-demo.cjs');
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'mello-demo-test-'),
  );
  t.after(async () => {
    for (const name of await fs.readdir(directory)) {
      assert.match(name, /^demo-[0-9a-f-]+-[012]\.png$/);
      await fs.unlink(path.join(directory, name));
    }
    await fs.rmdir(directory);
  });
  const first = await seedDemoData(sequelize, {
    city: 'Bengaluru',
    uploadDirectory: directory,
  });
  const second = await seedDemoData(sequelize, {
    city: 'Bengaluru',
    uploadDirectory: directory,
  });
  assert.equal(first.total, 22);
  assert.equal(first.photos, 66);
  assert.equal(second.likesCreated, 0);
  const [count] = await query(
    'SELECT count(*)::int AS total FROM user_profiles WHERE user_id IN (:ids)',
    { ids: first.userIds },
  );
  assert.equal(count.total, 22);
  assert.equal(DEMO_PROFILES.filter((x) => x.gender === 'WOMAN').length, 10);
  assert.equal(DEMO_PROFILES.filter((x) => x.orientation === 'GAY').length, 2);
  const image = await fs.readFile(path.join(directory, first.photoFiles[0]));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 360);
  assert.equal(image.readUInt32BE(20), 480);
  const { DiscoveryService } = require('../src/services/discovery.service.ts');
  const service = new DiscoveryService();
  const gayFeed = await service.feed(stableId('user', 'Reyansh'), 20, 0);
  assert.ok(
    gayFeed.profiles.some((x) => x.userId === stableId('user', 'Neil')),
  );
  const realFeed = await service.feed(a.profile.userId, 20, 0);
  const person = realFeed.profiles.find((x) =>
    first.userIds.includes(x.userId),
  );
  assert.ok(person);
  assert.equal(person.photos.length, 3);
  const action = await service.act(a.profile.userId, person.userId, 'LIKE');
  assert.equal(action.matched, false);
  assert.equal(action.matchId, null);
  const [automatic] = await query(
    'SELECT count(*)::int AS total FROM discovery_actions WHERE actor_id IN (:ids) AND target_id NOT IN (:ids)',
    { ids: first.userIds },
  );
  assert.equal(automatic.total, 0);
  // Previously seeded likes remain auditable but cannot be mistaken for a user's consent.
  await query(
    "INSERT INTO discovery_actions (actor_id,target_id,action,source) VALUES (:actor,:target,'LIKE','DEMO')",
    { actor: person.userId, target: a.profile.userId },
  );
  const repeated = await service.act(a.profile.userId, person.userId, 'LIKE');
  assert.equal(repeated.matched, false);
  assert.ok(
    !(await service.incomingLikes(a.profile.userId, 20, 0)).profiles.some(
      (item) => item.userId === person.userId,
    ),
  );
  const waiting = await service.incomingLikes(person.userId, 20, 0);
  assert.ok(waiting.profiles.some((item) => item.userId === a.profile.userId));
  const reciprocal = await service.act(person.userId, a.profile.userId, 'LIKE');
  assert.equal(reciprocal.matched, true);
  const [explicit] = await query(
    'SELECT source FROM discovery_actions WHERE actor_id=:actor AND target_id=:target',
    { actor: person.userId, target: a.profile.userId },
  );
  assert.equal(explicit.source, 'USER');
});

test('exhausted discovery reshuffles passes without repeats, respects preferences, and never recycles likes', async () => {
  const { DiscoveryService } = require('../src/services/discovery.service.ts');
  const { stableId } = require('../scripts/seed-demo.cjs');
  const service = new DiscoveryService();
  const viewer = stableId('user', 'Rohan');
  const initial = await service.feed(viewer, 20, 0);
  assert.equal(initial.feedMode, 'FRESH');
  assert.ok(initial.profiles.length >= 5);
  const allIds = initial.profiles.map((person) => person.userId);
  await service.act(viewer, allIds[0], 'PASS');
  const fresh = await service.feed(viewer, 20, 0);
  assert.equal(fresh.feedMode, 'FRESH');
  assert.ok(!fresh.profiles.some((person) => person.userId === allIds[0]));
  for (const id of allIds.slice(1)) await service.act(viewer, id, 'PASS');
  const seed = randomUUID();
  let page = await service.feed(viewer, 2, 0, { shuffleSeed: seed });
  const replay = await service.feed(viewer, 2, 0, { shuffleSeed: seed });
  assert.equal(page.feedMode, 'RECYCLED');
  assert.deepEqual(
    page.profiles.map((person) => person.userId),
    replay.profiles.map((person) => person.userId),
  );
  const seen = page.profiles.map((person) => person.userId);
  let steps = 0;
  while (page.nextCursor) {
    assert.ok(++steps < 20);
    page = await service.feed(viewer, 2, 0, {
      shuffleSeed: seed,
      after: page.nextCursor,
    });
    seen.push(...page.profiles.map((person) => person.userId));
  }
  assert.equal(new Set(seen).size, seen.length);
  assert.deepEqual([...seen].sort(), [...allIds].sort());
  const like = await service.act(viewer, seen[0], 'LIKE');
  assert.equal(like.matched, false);
  await assert.rejects(
    () => service.act(viewer, seen[0], 'PASS'),
    /already responded/,
  );
  assert.ok(
    !(await service.feed(viewer, 20, 0)).profiles.some(
      (person) => person.userId === seen[0],
    ),
  );
  const [paused] = await query(
    'SELECT account_id FROM users WHERE id=:userId',
    { userId: seen[1] },
  );
  await models.Account.update(
    { status: 'SUSPENDED' },
    { where: { id: paused.account_id } },
  );
  assert.ok(
    !(await service.feed(viewer, 20, 0)).profiles.some(
      (person) => person.userId === seen[1],
    ),
  );
  await models.Account.update(
    { status: 'ACTIVE' },
    { where: { id: paused.account_id } },
  );
  // A newly eligible profile must take priority over every recycled pass.
  await query(
    "DELETE FROM discovery_actions WHERE actor_id=:viewer AND target_id=:target AND action='PASS'",
    { viewer, target: seen[1] },
  );
  const newSuggestion = await service.feed(viewer, 20, 0, {
    shuffleSeed: seed,
    after: seen[2],
  });
  assert.equal(newSuggestion.feedMode, 'FRESH');
  assert.deepEqual(
    newSuggestion.profiles.map((person) => person.userId),
    [seen[1]],
  );
  for (const target of seen.slice(1)) await service.act(viewer, target, 'LIKE');
  assert.deepEqual((await service.feed(viewer, 20, 0)).profiles, []);
  await api(a, 'GET', '/discovery/feed?after=' + randomUUID(), undefined, 400);
  await api(a, 'GET', '/discovery/feed?shuffleSeed=bad', undefined, 400);
});
