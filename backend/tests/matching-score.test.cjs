const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  scorePair,
  jaccard,
  distanceKm,
} = require('../src/services/matching/scoring.ts');
const { matchingConfig } = require('../src/config/matching.ts');

const profile = (extra = {}) => ({
  userId: 'test',
  personalized: true,
  age: 26,
  cityId: null,
  latitude: null,
  longitude: null,
  createdAt: '2026-01-01',
  interests: [],
  languages: [],
  values: [],
  valuePreferences: [],
  languagePreferences: [],
  options: {},
  optionPreferences: {},
  minAge: 23,
  maxAge: 28,
  ageIsDealbreaker: true,
  maxDistanceKm: 50,
  preferSameCity: false,
  semanticText: '',
  ...extra,
});
test('matching uses real overlap, reciprocal preferences and conservative aggregation', () => {
  assert.equal(
    jaccard(['trek', 'music', 'cook'], ['trek', 'music', 'read']),
    0.5,
  );
  const a = profile({
    interests: ['trek'],
    values: ['kind'],
    valuePreferences: [{ id: 'kind', weight: 5 }],
  });
  const b = profile({
    interests: ['trek'],
    values: ['kind'],
    valuePreferences: [{ id: 'honesty', weight: 5 }],
  });
  assert.deepEqual(scorePair(a, b), scorePair(b, a));
  assert.equal(scorePair(a, b).score, 44); // 20 / (20+25), weaker direction.
  assert.ok(!JSON.stringify(scorePair(a, b)).includes('honesty'));
});
test('missing answers stay unknown, not false agreement or disagreement', () => {
  assert.equal(scorePair(profile(), profile()).score, null);
  assert.equal(scorePair(profile(), profile()).coverage, 0);
  const sparse = scorePair(
    profile({ interests: ['trek'] }),
    profile({ interests: ['trek'] }),
  );
  assert.equal(sparse.score, null);
  assert.equal(sparse.scoreUnavailable, 'INSUFFICIENT_PROFILE_DATA');
  assert.equal(sparse.coverage, 0.2);
  assert.equal(sparse.effectiveScore, 60);
});
test('equally acceptable alternatives preserve fit and private facts never explain a pair', () => {
  const props = {
    interests: ['walk'],
    languages: ['hi'],
    options: { DATING_INTENTION: ['serious'] },
    publicInterests: true,
    publicLanguages: false,
    labels: new Map([
      ['walk', 'Walking'],
      ['hi', 'Hindi'],
    ]),
  };
  const peer = profile(props);
  const viewer = profile({
    ...props,
    languagePreferences: [{ id: 'hi', weight: 3 }],
  });
  const first = scorePair(viewer, peer);
  viewer.languagePreferences.push({ id: 'en', weight: 3 });
  viewer.options.DATING_INTENTION.push('casual');
  assert.deepEqual(scorePair(viewer, peer), first);
  assert.deepEqual(first.reasons, ['You both enjoy Walking.']);
});
test('both people need current personalization permission', () => {
  const a = profile({ interests: ['trek'] });
  const b = profile({ interests: ['trek'], personalized: false });
  assert.equal(scorePair(a, b, 1).score, null);
  assert.equal(scorePair(a, b, 1).scoreUnavailable, 'PERSONALIZATION_REQUIRED');
  assert.equal(scorePair(a, b, 1).mode, 'BASELINE');
  assert.deepEqual(scorePair(a, b).reasons, []);
});
test('semantic signals are bounded and never create fake baseline scores', () => {
  const a = profile({
    interests: ['trek'],
    options: { DATING_INTENTION: ['long'] },
  });
  const b = profile({
    interests: ['music'],
    options: { DATING_INTENTION: ['long'] },
  });
  assert.equal(scorePair(a, b, 1).score, 64);
  assert.equal(scorePair(a, b, 1).mode, 'HYBRID');
  for (const bad of [NaN, Infinity, -1, 2])
    assert.equal(scorePair(a, b, bad).mode, 'RULES');
  assert.equal(scorePair(profile(), profile(), 1).score, null);
});
test('city-centre distance is finite and symmetric', () => {
  const a = profile({ latitude: 30.7333, longitude: 76.7794 });
  const b = profile({ latitude: 28.6139, longitude: 77.209 });
  assert.ok(distanceKm(a, b) > 200 && distanceKm(a, b) < 300);
  assert.ok(Math.abs(distanceKm(a, b) - distanceKm(b, a)) < 0.00001);
  assert.equal(distanceKm(a, a), 0);
  assert.equal(distanceKm(a, profile()), null);
});
test('soft age preference affects scoring without claiming missing intentions match', () => {
  const a = profile({ ageIsDealbreaker: false, interests: ['trek'] });
  const b = profile({ age: 40, ageIsDealbreaker: false, interests: ['trek'] });
  assert.equal(scorePair(a, b).score, null);
  assert.equal(scorePair(a, b).effectiveScore, 57.5);
  assert.equal(scorePair(a, b).coverage, 0.25);
  assert.equal(
    scorePair(
      profile({ ageIsDealbreaker: false }),
      profile({ ageIsDealbreaker: false }),
    ).score,
    null,
  );
});
test('hybrid keeps the rules cutoff stable and never promotes a structured goal conflict', async () => {
  const {
    MatchingService,
  } = require('../src/services/matching/matching.service.ts');
  const original = process.env.MATCHING_MODE;
  const ids = Array.from({ length: 70 }, (_, i) => 'person-' + i);
  const base = profile({
    options: { DATING_INTENTION: ['serious'] },
    interests: ['walking'],
    semanticText: 'I like walking',
  });
  const service = new MatchingService(
    {
      semantic: async (_, batch) => ({
        version: 'test',
        scores: new Map(batch.map((item, i) => [item.key, i / 64])),
      }),
    },
    async () => new Map(['viewer', ...ids].map((id) => [id, base])),
  );
  try {
    process.env.MATCHING_MODE = 'RULES';
    const rules = await service.rank('viewer', ids);
    process.env.MATCHING_MODE = 'HYBRID';
    const hybrid = await service.rank('viewer', ids);
    assert.deepEqual(hybrid.ids.slice(64), rules.ids.slice(64));
    assert.notEqual(hybrid.ids[0], rules.ids[0]);
    assert.equal(hybrid.rankings.get(ids[64]).mode, 'RULES');
    const opposite = { ...base, options: { DATING_INTENTION: ['casual'] } };
    assert.deepEqual(scorePair(base, opposite, 1), scorePair(base, opposite));
  } finally {
    if (original === undefined) delete process.env.MATCHING_MODE;
    else process.env.MATCHING_MODE = original;
  }
});
test('rollout is stable, supports a baseline control, and can be disabled without restarting', () => {
  const savedMode = process.env.MATCHING_MODE,
    savedRollout = process.env.MATCHING_ROLLOUT_PERCENT;
  try {
    process.env.MATCHING_MODE = 'HYBRID';
    process.env.MATCHING_ROLLOUT_PERCENT = '0';
    assert.equal(matchingConfig.modeFor('viewer'), 'BASELINE');
    process.env.MATCHING_ROLLOUT_PERCENT = '100';
    assert.equal(matchingConfig.modeFor('viewer'), 'HYBRID');
    process.env.MATCHING_ROLLOUT_PERCENT = '50';
    const modes = Array.from({ length: 100 }, (_, i) =>
      matchingConfig.modeFor(`user-${i}`),
    );
    assert.deepEqual(
      modes,
      Array.from({ length: 100 }, (_, i) =>
        matchingConfig.modeFor(`user-${i}`),
      ),
    );
    assert.ok(modes.includes('BASELINE') && modes.includes('HYBRID'));
  } finally {
    if (savedMode === undefined) delete process.env.MATCHING_MODE;
    else process.env.MATCHING_MODE = savedMode;
    if (savedRollout === undefined) delete process.env.MATCHING_ROLLOUT_PERCENT;
    else process.env.MATCHING_ROLLOUT_PERCENT = savedRollout;
  }
});
