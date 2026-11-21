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
let completeTestProfile;
let matchingUsers;

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
            ...(type === 'PLATFORM_USER'
              ? { platformUser: { name: 'Test Photo Reviewer' } }
              : {}),
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
        if (category.code !== 'DATING_INTENTION')
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
          moderationStatus: 'APPROVED',
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
    completeTestProfile = profile;
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
  assert.equal(card.compatibility.isDemo, false);
  assert.equal(card.compatibility.percentage, null);
  assert.equal(card.ranking.score, null);
  assert.equal(card.ranking.scoreUnavailable, 'PERSONALIZATION_REQUIRED');
  assert.equal(card.ranking.mode, 'BASELINE');
  assert.equal(card.ranking.coverage, 0);
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
  const pending = after.find((p) => p.moderationStatus === 'PENDING');
  assert.ok(pending);
  // Restore the shared discovery fixture after its replacement photo passes review.
  await query(
    "UPDATE user_photos SET moderation_status='APPROVED' WHERE id=:id",
    { id: pending.id },
  );
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
  const publicUrl = new URL(photo.url, base);
  const ownerUrl = `${base}/dating/photos/${photo.id}/file`;
  assert.equal((await fetch(publicUrl)).status, 404);
  assert.equal((await fetch(ownerUrl)).status, 401);
  assert.equal(
    (await fetch(ownerUrl, { headers: { Authorization: `Bearer ${b.token}` } }))
      .status,
    404,
  );
  const uploaded = await fetch(ownerUrl, {
    headers: { Authorization: `Bearer ${draft.token}` },
  });
  assert.equal(uploaded.status, 200);
  assert.equal(
    uploaded.headers.get('Cross-Origin-Resource-Policy'),
    'cross-origin',
  );
  assert.deepEqual(Buffer.from(await uploaded.arrayBuffer()), bytes);
  const reviewer = await restaurantAccount('PLATFORM_USER');
  const unassigned = await restaurantAccount('PLATFORM_USER');
  await query('DELETE FROM account_roles WHERE account_id=:accountId', {
    accountId: unassigned.account.id,
  });
  await api(draft, 'GET', '/photo-review', undefined, 403);
  await api(partner, 'GET', '/photo-review', undefined, 403);
  await api(unassigned, 'GET', '/photo-review', undefined, 403);
  await api(null, 'GET', '/photo-review', undefined, 401);
  const queue = await api(reviewer, 'GET', '/photo-review');
  assert.ok(queue.photos.some((item) => item.id === photo.id));
  assert.equal(
    (
      await fetch(`${base}/photo-review/${photo.id}/file`, {
        headers: { Authorization: `Bearer ${reviewer.token}` },
      })
    ).status,
    200,
  );
  const {
    moderateNextPhoto,
  } = require('../src/services/dating/photo-moderation.ts');
  const safe = async (key) => {
    assert.equal(key, `profile-photos/${filename}`);
    return { kind: 'scored', risk: 0.005, model: 'fixture' };
  };
  assert.equal(await moderateNextPhoto('shadow', 0.01, safe), true);
  const shadow = await api(draft, 'GET', '/dating/photos');
  assert.equal(
    shadow.photos.find((p) => p.id === photo.id).moderationStatus,
    'PENDING',
  );
  assert.equal(await moderateNextPhoto('shadow', 0.01, safe), false);
  const aiKey = 'photo-worker-integration-key-minimum-length';
  let reviewedBytes;
  let reviewedKey;
  let risk = 0.9;
  const photoAi = require('node:http').createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    reviewedBytes = Buffer.concat(chunks);
    reviewedKey = req.headers['x-service-key'];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ kind: 'scored', risk, model: 'fixture' }));
  });
  await new Promise((resolve) => photoAi.listen(0, '127.0.0.1', resolve));
  const oldKey = process.env.MATCHING_AI_KEY;
  const oldUrl = process.env.MATCHING_AI_URL;
  process.env.MATCHING_AI_URL = `http://127.0.0.1:${photoAi.address().port}`;
  process.env.MATCHING_AI_KEY = aiKey;
  try {
    assert.equal(await moderateNextPhoto('auto', 0.01), true);
    assert.equal((await fetch(publicUrl)).status, 404);
    assert.equal(await moderateNextPhoto('auto', 0.01), false);
    await query(
      'UPDATE user_photos SET moderation_assessment=NULL WHERE id=:id',
      { id: photo.id },
    );
    risk = 0.005;
    assert.equal(await moderateNextPhoto('auto', 0.01), true);
    assert.equal(reviewedKey, aiKey);
    assert.deepEqual(reviewedBytes, bytes);
    await api(
      reviewer,
      'PATCH',
      `/photo-review/${photo.id}`,
      { status: 'REJECTED' },
      409,
    );
  } finally {
    if (oldKey === undefined) delete process.env.MATCHING_AI_KEY;
    else process.env.MATCHING_AI_KEY = oldKey;
    if (oldUrl === undefined) delete process.env.MATCHING_AI_URL;
    else process.env.MATCHING_AI_URL = oldUrl;
    await new Promise((resolve, reject) =>
      photoAi.close((error) => (error ? reject(error) : resolve())),
    );
  }
  assert.equal((await fetch(publicUrl)).status, 200);
  // Put the fixture back in the queue to exercise the independent human review path.
  await query(
    "UPDATE user_photos SET moderation_status='PENDING' WHERE id=:id",
    {
      id: photo.id,
    },
  );
  await api(
    unassigned,
    'PATCH',
    `/photo-review/${photo.id}`,
    { status: 'APPROVED' },
    403,
  );
  await api(reviewer, 'PATCH', `/photo-review/${photo.id}`, {
    status: 'REJECTED',
  });
  assert.equal((await fetch(publicUrl)).status, 404);
  await api(reviewer, 'GET', `/photo-review/${photo.id}/file`, undefined, 404);
  const [recorded] = await query(
    'SELECT moderation_assessment AS assessment FROM user_photos WHERE id=:id',
    { id: photo.id },
  );
  assert.equal(recorded.assessment.risk, 0.005);
  assert.equal(recorded.assessment.manualReview.accountId, reviewer.account.id);
  assert.equal(recorded.assessment.manualReview.status, 'REJECTED');
  assert.ok(recorded.assessment.manualReview.reviewedAt);
  await query(
    "UPDATE user_photos SET moderation_status='PENDING' WHERE id=:id",
    {
      id: photo.id,
    },
  );
  await api(reviewer, 'PATCH', `/photo-review/${photo.id}`, {
    status: 'APPROVED',
  });
  assert.equal((await fetch(publicUrl)).status, 200);
  await api(draft, 'PUT', '/dating/visibility/PHOTOS', {
    visibility: 'PRIVATE',
  });
  assert.equal((await fetch(publicUrl)).status, 404);
  assert.equal(
    (
      await fetch(ownerUrl, {
        headers: { Authorization: `Bearer ${draft.token}` },
      })
    ).status,
    200,
  );
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
  const [optIns] = await query(
    "SELECT count(*)::int AS total FROM user_consents WHERE user_id IN (:ids) AND consent_code='PERSONALIZED_MATCHING' AND status='GRANTED'",
    { ids: first.userIds },
  );
  assert.equal(optIns.total, first.total);
  assert.equal(DEMO_PROFILES.filter((x) => x.gender === 'WOMAN').length, 10);
  assert.equal(DEMO_PROFILES.filter((x) => x.orientation === 'GAY').length, 2);
  const image = await fs.readFile(path.join(directory, first.photoFiles[0]));
  assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(image.readUInt32BE(16), 360);
  assert.equal(image.readUInt32BE(20), 480);
  const { DiscoveryService } = require('../src/services/discovery.service.ts');
  const service = new DiscoveryService();
  const gayFeed = await service.feed(stableId('user', 'Reyansh'), 20, 0);
  const demoPair = gayFeed.profiles.find(
    (x) => x.userId === stableId('user', 'Neil'),
  );
  assert.ok(demoPair);
  assert.ok(Number.isInteger(demoPair.ranking.score));
  assert.equal(demoPair.compatibility.percentage, demoPair.ranking.score);
  const realFeed = await service.feed(a.profile.userId, 20, 0);
  const person = realFeed.profiles.find((x) =>
    first.userIds.includes(x.userId),
  );
  assert.ok(person);
  assert.equal(person.photos.length, 3);
  assert.equal(person.ranking.score, null);
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

test('dating users can browse published cafe offerings and photos but cannot manage content', async (t) => {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.append('photo', new File([bytes], 'menu.png', { type: 'image/png' }));
  const upload = await fetch(`${base}/partner/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${partner.token}` },
    body: form,
  });
  assert.equal(upload.status, 201);
  const photo = await upload.json();
  t.after(() =>
    require('node:fs/promises').unlink(
      path.resolve('uploads/partner-photos', path.basename(photo.url)),
    ),
  );
  const publishedIds = [];
  for (const kind of ['MENU', 'PACKAGE', 'PLAN', 'EVENT']) {
    const title = `Published ${kind}`;
    const content = await api(
      partner,
      'POST',
      '/partner/content',
      {
        kind,
        title,
        description: 'Food, drinks and experiences from the cafe.',
        priceInr: 250,
        isPublished: true,
        photoIds: [photo.id],
        ...(kind === 'EVENT'
          ? { startsAt: new Date(Date.now() + 86400000).toISOString() }
          : {}),
      },
      201,
    );
    publishedIds.push(content.find((item) => item.title === title).id);
  }
  await api(
    partner,
    'POST',
    '/partner/content',
    { kind: 'MENU', title: 'Hidden draft' },
    201,
  );
  await api(
    partner,
    'POST',
    '/partner/content',
    {
      kind: 'EVENT',
      title: 'Expired event',
      isPublished: true,
      startsAt: new Date(Date.now() - 86400000).toISOString(),
    },
    201,
  );
  const removed = await api(
    partner,
    'POST',
    '/partner/content',
    { kind: 'MENU', title: 'Removed menu', isPublished: true },
    201,
  );
  await api(
    partner,
    'DELETE',
    `/partner/content/${removed.find((item) => item.title === 'Removed menu').id}`,
  );
  const route = `/discovery/venues/${venueId}/content`;
  await api(null, 'GET', route, undefined, 401);
  await api(draft, 'GET', route, undefined, 403);
  await api(partner, 'GET', route, undefined, 403);
  const visible = await api(a, 'GET', route);
  assert.deepEqual(visible.map((item) => item.id).sort(), publishedIds.sort());
  for (const item of visible) {
    assert.equal(item.priceInr, 250);
    assert.equal(
      item.description,
      'Food, drinks and experiences from the cafe.',
    );
    assert.deepEqual(item.photos, [photo]);
    assert.equal(item.photoIds, undefined);
    assert.equal(item.isPublished, undefined);
    assert.equal(item.updatedAt, undefined);
  }
  const image = await fetch(new URL(visible[0].photos[0].url, base));
  assert.equal(image.status, 200);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
  for (const [method, url] of [
    ['POST', '/partner/content'],
    ['PUT', `/partner/content/${publishedIds[0]}`],
    ['DELETE', `/partner/content/${publishedIds[0]}`],
  ]) {
    await api(
      a,
      method,
      url,
      { kind: 'MENU', title: 'Unauthorized edit' },
      403,
    );
  }
  await api(
    partnerOther,
    'PUT',
    `/partner/content/${publishedIds[0]}`,
    { kind: 'MENU', title: 'Other cafe edit' },
    404,
  );
  try {
    await query(
      'UPDATE partner_listings SET is_published=false WHERE partner_id=:id',
      { id: venueId },
    );
    assert.deepEqual(await api(a, 'GET', route), []);
    await query(
      'UPDATE partner_listings SET is_published=true WHERE partner_id=:id',
      { id: venueId },
    );
    await query("UPDATE partners SET status='INACTIVE' WHERE id=:id", {
      id: venueId,
    });
    assert.deepEqual(await api(a, 'GET', route), []);
  } finally {
    await query(
      'UPDATE partner_listings SET is_published=true WHERE partner_id=:id',
      { id: venueId },
    );
    await query("UPDATE partners SET status='ACTIVE' WHERE id=:id", {
      id: venueId,
    });
  }
  assert.equal((await api(a, 'GET', route)).length, 4);
});

test('ranking checks consent, scores the full pool and keeps cursor pages stable after actions', async () => {
  const people = await Promise.all([
    restaurantAccount(),
    restaurantAccount(),
    restaurantAccount(),
  ]);
  // Embedded PostgreSQL has one connection: keep onboarding transactions sequential.
  for (let index = 0; index < people.length; index++)
    await completeTestProfile(people[index], `Ranking Test ${index}`);
  matchingUsers = people;
  const [viewer, best, other] = people;
  const catalog = await api(viewer, 'GET', '/dating/catalog');
  for (const who of people)
    await api(
      who,
      'POST',
      '/dating/consents',
      {
        consentCode: 'PERSONALIZED_MATCHING',
        policyVersion: catalog.consent.policyVersion,
        status: 'GRANTED',
      },
      201,
    );
  await api(other, 'PUT', '/dating/interests', {
    selections: catalog.interests.slice(-3).map((i) => ({ interestId: i.id })),
  });
  await query(
    "UPDATE user_profiles SET created_at='2001-01-01' WHERE user_id=:id",
    { id: best.profile.userId },
  );
  const first = await api(viewer, 'GET', '/discovery/feed?limit=1');
  assert.equal(first.profiles[0].userId, best.profile.userId);
  assert.equal(first.profiles[0].ranking.mode, 'RULES');
  assert.ok(first.profiles[0].ranking.score > 0);
  assert.ok(first.nextRankCursor !== null);
  const sessionId = first.feedSessionId;
  const impression = {
    feedSessionId: sessionId,
    targetIds: [best.profile.userId],
  };
  assert.equal(
    (await api(viewer, 'POST', '/discovery/impressions', impression)).recorded,
    1,
  );
  assert.equal(
    (await api(viewer, 'POST', '/discovery/impressions', impression)).recorded,
    0,
  );
  const [attribution] = await query(
    'SELECT served_version FROM discovery_impressions WHERE session_id=:sessionId AND target_id=:id',
    { sessionId, id: best.profile.userId },
  );
  assert.equal(attribution.served_version, 'RULES:reciprocal-v2');
  await api(
    viewer,
    'POST',
    '/discovery/impressions',
    { feedSessionId: sessionId, targetIds: [other.profile.userId] },
    404,
  );
  await api(other, 'POST', '/discovery/impressions', impression, 404);
  await api(
    other,
    'GET',
    `/discovery/feed?feedSessionId=${sessionId}&cursor=0`,
    undefined,
    404,
  );
  await api(viewer, 'POST', '/discovery/actions', {
    targetId: best.profile.userId,
    action: 'PASS',
  });
  // Profile edits cannot reshuffle already-issued cursor positions.
  await api(other, 'PUT', '/dating/interests', {
    selections: catalog.interests
      .slice(0, 3)
      .map((i) => ({ interestId: i.id })),
  });
  const next = await api(
    viewer,
    'GET',
    `/discovery/feed?limit=1&feedSessionId=${sessionId}&cursor=${first.nextRankCursor}`,
  );
  assert.equal(next.profiles[0].userId, other.profile.userId);
  assert.notEqual(next.profiles[0].userId, best.profile.userId);
  await api(
    other,
    'POST',
    '/dating/consents',
    {
      consentCode: 'PERSONALIZED_MATCHING',
      policyVersion: catalog.consent.policyVersion,
      status: 'REVOKED',
    },
    201,
  );
  const revoked = await api(
    viewer,
    'GET',
    `/discovery/feed?limit=1&feedSessionId=${sessionId}&cursor=${first.nextRankCursor}`,
  );
  assert.equal(revoked.profiles[0].ranking.score, null);
  assert.equal(
    revoked.profiles[0].ranking.scoreUnavailable,
    'PERSONALIZATION_REQUIRED',
  );
  assert.deepEqual(revoked.profiles[0].ranking.reasons, []);
  await api(viewer, 'POST', '/discovery/impressions', {
    feedSessionId: sessionId,
    targetIds: [other.profile.userId],
  });
  const [fallback] = await query(
    'SELECT served_version FROM discovery_impressions WHERE session_id=:sessionId AND target_id=:id',
    { sessionId, id: other.profile.userId },
  );
  assert.equal(fallback.served_version, 'BASELINE:reciprocal-v2');
  await query(
    "UPDATE discovery_feed_sessions SET expires_at=now()-interval '1 minute' WHERE id=:id",
    { id: sessionId },
  );
  await api(
    viewer,
    'GET',
    `/discovery/feed?feedSessionId=${sessionId}&cursor=0`,
    undefined,
    404,
  );
  await api(viewer, 'GET', '/discovery/feed?cursor=0', undefined, 400);
});

test('language and partner-value dealbreakers are reciprocal and missing required answers exclude', async () => {
  const [viewer, , candidate] = matchingUsers;
  const catalog = await api(viewer, 'GET', '/dating/catalog');
  const first = catalog.languages[0].id,
    second = catalog.languages[1].id;
  const id = candidate.profile.userId;
  const shown = async (who, target) =>
    (await api(who, 'GET', '/discovery/feed?limit=20')).profiles.some(
      (p) => p.userId === target,
    );
  await api(viewer, 'PUT', '/dating/languages', {
    selections: [{ languageId: first }],
  });
  await api(candidate, 'PUT', '/dating/languages', {
    selections: [{ languageId: second }],
  });
  await api(candidate, 'PUT', '/dating/language-preferences', {
    preferences: [{ languageId: second, isDealbreaker: true }],
  });
  assert.equal(await shown(viewer, id), false);
  await api(viewer, 'PUT', '/dating/languages', {
    selections: [{ languageId: second }],
  });
  assert.equal(await shown(viewer, id), true);
  await api(candidate, 'PUT', '/dating/language-preferences', {
    preferences: [],
  });
  await api(viewer, 'PUT', '/dating/language-preferences', {
    preferences: [
      { languageId: first, isDealbreaker: true },
      { languageId: second, isDealbreaker: true },
    ],
  });
  assert.equal(await shown(viewer, id), true); // Acceptable languages are OR alternatives.
  await api(viewer, 'PUT', '/dating/language-preferences', { preferences: [] });
  const valueId = catalog.values[0].id;
  await api(viewer, 'PUT', '/dating/partner-value-preferences', {
    preferences: [{ valueId, isDealbreaker: true }],
  });
  assert.equal(await shown(viewer, id), false);
  await api(candidate, 'PUT', '/dating/values', { selections: [{ valueId }] });
  assert.equal(await shown(viewer, id), true);
  await api(candidate, 'PUT', '/dating/partner-value-preferences', {
    preferences: [{ valueId, isDealbreaker: true }],
  });
  assert.equal(await shown(viewer, id), false);
  await api(viewer, 'PUT', '/dating/values', { selections: [{ valueId }] });
  assert.equal(await shown(viewer, id), true);
});

test('private/sensitive inputs stay out of ranking projections and openers require explicit mutual likes', async () => {
  const [viewer, , candidate] = matchingUsers;
  const {
    matchingProfiles,
  } = require('../src/repositories/matching.repository.ts');
  const catalog = await api(viewer, 'GET', '/dating/catalog');
  await api(viewer, 'PUT', '/dating/visibility/DATING_INTENTION', {
    visibility: 'PRIVATE',
  });
  const projected = (await matchingProfiles([viewer.profile.userId])).get(
    viewer.profile.userId,
  );
  assert.equal(projected.options.GENDER_IDENTITY, undefined);
  assert.equal(projected.options.DATING_INTENTION, undefined);
  assert.equal(projected.dateOfBirth, undefined);
  assert.equal(projected.phone, undefined);
  await api(viewer, 'PUT', '/dating/visibility/BIO', { visibility: 'PRIVATE' });
  await api(viewer, 'PUT', '/dating/visibility/INTERESTS', {
    visibility: 'PRIVATE',
  });
  const privateProjection = (
    await matchingProfiles([viewer.profile.userId])
  ).get(viewer.profile.userId);
  assert.equal(privateProjection.semanticText, '');
  assert.deepEqual(privateProjection.interests, []);
  await api(viewer, 'PUT', '/dating/visibility/BIO', { visibility: 'PROFILE' });
  await api(viewer, 'PUT', '/dating/visibility/INTERESTS', {
    visibility: 'PROFILE',
  });
  await api(viewer, 'PUT', '/dating/visibility/DATING_INTENTION', {
    visibility: 'PROFILE',
  });
  const fake = randomUUID();
  await api(viewer, 'POST', `/chat/${fake}/icebreakers`, {}, 404);
  const first = await api(viewer, 'POST', '/discovery/actions', {
    targetId: candidate.profile.userId,
    action: 'LIKE',
  });
  assert.equal(first.matched, false);
  const matched = await api(candidate, 'POST', '/discovery/actions', {
    targetId: viewer.profile.userId,
    action: 'LIKE',
  });
  const openers = await api(
    viewer,
    'POST',
    `/chat/${matched.matchId}/icebreakers`,
    {},
  );
  assert.ok(openers.suggestions.length > 0);
  assert.equal(openers.source, 'GROUNDED_TEMPLATE');
  assert.equal(
    (await api(viewer, 'GET', `/chat/${matched.matchId}/messages`)).messages
      .length,
    0,
  );
  await api(
    matchingUsers[1],
    'POST',
    `/chat/${matched.matchId}/icebreakers`,
    {},
    404,
  );
  const report = require('node:fs').readFileSync(
    path.join(__dirname, '../database/reports/discovery-quality.sql'),
    'utf8',
  );
  assert.ok(Array.isArray(await query(report)));
  const exposure = require('node:fs').readFileSync(
    path.join(__dirname, '../database/reports/discovery-exposure.sql'),
    'utf8',
  );
  assert.ok((await query(exposure)).length > 0);
});

test('onboarding goals reach discovery, private cards omit hidden data, and photos require approval', async () => {
  const viewer = await restaurantAccount(),
    peer = await restaurantAccount();
  for (const person of [viewer, peer])
    await completeTestProfile(person, 'Goal test');
  const catalog = await api(viewer, 'GET', '/dating/catalog');
  const category = catalog.profileOptionCategories.find(
    (c) => c.code === 'DATING_INTENTION',
  );
  const [goal, other] = catalog.profileOptions.filter(
    (o) => o.categoryId === category.id,
  );
  const peerId = peer.profile.userId,
    viewerId = viewer.profile.userId;
  const { profile: privateProfile } = await api(peer, 'GET', '/dating/state');
  assert.equal(privateProfile.currentCity.name, 'Bengaluru');
  await api(peer, 'PUT', '/dating/profile', {
    displayName: privateProfile.displayName,
    dateOfBirth: privateProfile.dateOfBirth,
    bio: privateProfile.bio,
    currentCityId: privateProfile.currentCityId,
    jobTitle: 'Software engineer',
    companyName: 'Private company',
  });
  const options = '/dating/profile-options/' + category.id;
  const selects = (id) => ({ selections: [{ optionId: id }] });
  const {
    matchingProfiles,
  } = require('../src/repositories/matching.repository.ts');
  const projected = async () => (await matchingProfiles([peerId])).get(peerId);
  await api(peer, 'PUT', options, selects(goal.id));
  assert.deepEqual((await projected()).options.DATING_INTENTION, [goal.id]);
  assert.equal((await projected()).publicIntentions, false);
  await api(viewer, 'PUT', options, {
    ...selects(goal.id),
    intentionSettings: {
      visibility: 'PROFILE',
      strength: 'REQUIRE',
      partnerOptionIds: [goal.id],
    },
  });
  await api(peer, 'PUT', options, selects(other.id));
  await api(
    viewer,
    'POST',
    '/discovery/actions',
    { action: 'LIKE', targetId: peerId },
    404,
  );
  await api(peer, 'PUT', options, {
    ...selects(goal.id),
    intentionSettings: {
      visibility: 'PRIVATE',
      strength: 'OPEN',
      partnerOptionIds: [],
    },
  });
  await api(peer, 'PUT', options, selects(goal.id));
  assert.equal((await projected()).options.DATING_INTENTION, undefined);
  await api(
    viewer,
    'POST',
    '/discovery/actions',
    { action: 'LIKE', targetId: peerId },
    404,
  );
  await api(peer, 'PUT', '/dating/visibility/DATING_INTENTION', {
    visibility: 'MATCHING_ONLY',
  });
  await api(peer, 'PUT', '/dating/languages', {
    selections: [{ languageId: catalog.languages[0].id }],
  });
  const prompt = catalog.prompts[0];
  await api(peer, 'PUT', '/dating/prompt-answers/' + prompt.id, {
    answerText: 'Personal prompt answer',
    displayOrder: 0,
  });
  for (const [field, visibility] of [
    ['BIO', 'PRIVATE'],
    ['INTERESTS', 'MATCHING_ONLY'],
    ['LANGUAGES', 'PRIVATE'],
    ['PROMPTS', 'MATCHING_ONLY'],
  ])
    await api(peer, 'PUT', '/dating/visibility/' + field, { visibility });
  await api(peer, 'POST', '/discovery/actions', {
    action: 'LIKE',
    targetId: viewerId,
  });
  const incoming = async () =>
    (await api(viewer, 'GET', '/discovery/likes')).profiles.find(
      (p) => p.userId === peerId,
    );
  const card = await incoming();
  assert.equal(card.profile.bio, null);
  assert.equal(card.profile.jobTitle, undefined);
  await api(peer, 'PUT', '/dating/visibility/JOB', { visibility: 'PROFILE' });
  const publicProfile = (await incoming()).profile;
  assert.equal(publicProfile.jobTitle, 'Software engineer');
  assert.equal(publicProfile.companyName, undefined);
  assert.equal(
    (await api(peer, 'GET', '/dating/preview')).profile.jobTitle,
    'Software engineer',
  );
  for (const field of ['prompts', 'languages', 'interests'])
    assert.deepEqual(card[field], []);
  assert.ok(
    !card.profileOptions.some((o) => o.categoryCode === 'DATING_INTENTION'),
  );
  const photo = card.photos[0].id;
  for (const status of ['PENDING', 'REJECTED']) {
    await query(
      'UPDATE user_photos SET moderation_status=:status WHERE id=:photo',
      { status, photo },
    );
    assert.equal(await incoming(), undefined);
    const blocked = await api(peer, 'GET', '/discovery/feed');
    assert.deepEqual(blocked.profiles, []);
    assert.equal(blocked.needsApprovedPhotos, true);
    assert.ok(
      !(await api(peer, 'GET', '/dating/preview')).photos.some(
        (p) => p.id === photo,
      ),
    );
  }
  await query(
    "UPDATE user_photos SET moderation_status='APPROVED' WHERE id=:photo",
    { photo },
  );
  await api(peer, 'PUT', '/dating/visibility/PROMPTS', {
    visibility: 'PROFILE',
  });
  await query(
    "UPDATE user_prompt_answers SET moderation_status='REJECTED' WHERE user_id=:peerId",
    { peerId },
  );
  assert.deepEqual((await incoming()).prompts, []);
});

test('hiding is durable, reciprocal, and revokes discovery and match access', async () => {
  const [viewer, best, peer] = matchingUsers;
  const viewerId = viewer.profile.userId,
    peerId = peer.profile.userId,
    bestId = best.profile.userId;
  const {
    DiscoveryRepository,
  } = require('../src/repositories/discovery.repository.ts');
  const repo = new DiscoveryRepository();
  const matches = await api(viewer, 'GET', '/discovery/matches');
  const match = matches.find((m) => m.person.userId === peerId);
  assert.ok(match);
  await api(viewer, 'PUT', '/discovery/matches/' + match.id + '/feedback', {
    worthwhile: true,
  });
  await api(
    best,
    'PUT',
    '/discovery/matches/' + match.id + '/feedback',
    { worthwhile: true },
    404,
  );
  const session = await api(best, 'GET', '/discovery/feed');
  await api(viewer, 'PUT', '/discovery/exclusions/' + bestId);
  const paged = await api(
    best,
    'GET',
    '/discovery/feed?feedSessionId=' + session.feedSessionId,
  );
  assert.ok(!paged.profiles.some((p) => p.userId === viewerId));
  assert.ok(
    !(await repo.passed(viewerId, randomUUID(), null, 200)).some(
      (p) => p.userId === bestId,
    ),
  );
  for (let i = 0; i < 2; i++)
    await api(viewer, 'PUT', '/discovery/exclusions/' + peerId, {
      reportReason: 'HARASSMENT',
    });
  const reports = await query(
    'SELECT report_reason FROM discovery_exclusions WHERE actor_id=:viewerId AND target_id=:peerId',
    { viewerId, peerId },
  );
  assert.deepEqual(reports, [{ report_reason: 'HARASSMENT' }]);
  for (const [who, otherId] of [
    [viewer, peerId],
    [peer, viewerId],
  ]) {
    assert.ok(
      !(await api(who, 'GET', '/discovery/matches')).some(
        (m) => m.id === match.id,
      ),
    );
    assert.ok(
      !(await api(who, 'GET', '/chat/conversations')).some(
        (m) => m.matchId === match.id,
      ),
    );
    await api(who, 'GET', '/chat/' + match.id + '/messages', undefined, 404);
    await api(who, 'POST', '/chat/' + match.id + '/icebreakers', {}, 404);
    await api(
      who,
      'POST',
      '/discovery/actions',
      { targetId: otherId, action: 'LIKE' },
      404,
    );
  }
});
test('outcome report assigns each pair once and bounds two-way conversations by exposure time', async () => {
  const t = await sequelize.transaction();
  const params = {
    left: a.profile.userId,
    right: b.profile.userId,
    matchId,
    first: randomUUID(),
    second: randomUUID(),
  };
  const run = (sql) =>
    sequelize.query(sql, {
      replacements: params,
      transaction: t,
      type: require('sequelize').QueryTypes.SELECT,
    });
  try {
    await run(`INSERT INTO discovery_feed_sessions(id,user_id,algorithm_version,expires_at)
      VALUES (:first,:left,'qa-first',now()),(:second,:right,'qa-second',now()) RETURNING id`);
    await run(
      `INSERT INTO discovery_feed_items(session_id,target_id,position) VALUES (:first,:right,0),(:second,:left,0) RETURNING position`,
    );
    await run(`INSERT INTO discovery_impressions(session_id,user_id,target_id,algorithm_version,served_version,first_seen_at)
      VALUES (:first,:left,:right,'qa-first','RULES',now()-interval '14 days'),(:second,:right,:left,'qa-second','HYBRID',now()-interval '13 days') RETURNING target_id`);
    await run(
      "UPDATE matches SET created_at=now()-interval '13 days' WHERE id=:matchId RETURNING id",
    );
    await run(
      "UPDATE chat_messages SET created_at=now()-interval '12 days' WHERE match_id=:matchId AND sequence=1 RETURNING id",
    );
    const [first] = await run(
      'SELECT sender_id FROM chat_messages WHERE match_id=:matchId AND sequence=1',
    );
    params.sender = first.sender_id;
    const sql = require('node:fs').readFileSync(
      path.join(__dirname, '../database/reports/discovery-quality.sql'),
      'utf8',
    );
    const result = async () => {
      const report = await run(sql);
      assert.ok(!report.some((r) => r.algorithm_version === 'qa-second'));
      return report.find((r) => r.algorithm_version === 'qa-first');
    };
    assert.equal(
      Number((await result()).two_way_conversations_within_7_days),
      0,
    );
    await run(
      "UPDATE chat_messages SET created_at=now()-interval '11 days' WHERE match_id=:matchId AND sender_id<>:sender RETURNING id",
    );
    const row = await result();
    assert.equal(Number(row.exposed_pairs), 1);
    assert.equal(Number(row.two_way_conversations_per_exposed_pair), 1);
  } finally {
    await t.rollback();
  }
});

test('hybrid service calls are consent-gated and merge semantic evidence without changing mutual-match rules', async () => {
  const [viewer, , candidate] = matchingUsers;
  const {
    MatchingService,
  } = require('../src/services/matching/matching.service.ts');
  const catalog = await api(viewer, 'GET', '/dating/catalog');
  const savedMode = process.env.MATCHING_MODE,
    savedRollout = process.env.MATCHING_ROLLOUT_PERCENT;
  let calls = 0;
  const ranker = new MatchingService({
    semantic: async (text, batch) => {
      calls++;
      assert.equal(typeof text, 'string');
      assert.deepEqual(Object.keys(batch[0]).sort(), ['key', 'text']);
      return {
        version: 'integration-test-encoder',
        scores: new Map([[candidate.profile.userId, 0.8]]),
      };
    },
  });
  try {
    process.env.MATCHING_MODE = 'HYBRID';
    process.env.MATCHING_ROLLOUT_PERCENT = '100';
    const denied = await ranker.rank(viewer.profile.userId, [
      candidate.profile.userId,
    ]);
    assert.equal(
      denied.rankings.get(candidate.profile.userId).mode,
      'BASELINE',
    );
    assert.equal(calls, 0);
    await api(
      candidate,
      'POST',
      '/dating/consents',
      {
        consentCode: 'PERSONALIZED_MATCHING',
        policyVersion: catalog.consent.policyVersion,
        status: 'GRANTED',
      },
      201,
    );
    const allowed = await ranker.rank(viewer.profile.userId, [
      candidate.profile.userId,
    ]);
    assert.equal(allowed.rankings.get(candidate.profile.userId).mode, 'HYBRID');
    assert.equal(calls, 1);
    await api(
      candidate,
      'POST',
      '/dating/consents',
      {
        consentCode: 'PERSONALIZED_MATCHING',
        policyVersion: 'outdated-policy',
        status: 'GRANTED',
      },
      201,
    );
    const outdated = await ranker.rank(viewer.profile.userId, [
      candidate.profile.userId,
    ]);
    assert.equal(outdated.rankings.get(candidate.profile.userId).score, null);
    assert.equal(calls, 1);
  } finally {
    if (savedMode === undefined) delete process.env.MATCHING_MODE;
    else process.env.MATCHING_MODE = savedMode;
    if (savedRollout === undefined) delete process.env.MATCHING_ROLLOUT_PERCENT;
    else process.env.MATCHING_ROLLOUT_PERCENT = savedRollout;
  }
});
