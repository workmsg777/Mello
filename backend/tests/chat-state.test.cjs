const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  mergeMessages,
  messageId,
} = require('../../frontend/src/features/chat/message-state.ts');

test('reconnect, acknowledgement and broadcast merge without duplicate or downgraded messages', () => {
  const queued = {
    clientMessageId: 'first',
    sequence: 0,
    body: 'hello',
    delivery: 'queued',
    createdAt: '2026-10-26T00:00:00Z',
  };
  const saved = { ...queued, sequence: 1, delivery: undefined };
  const second = {
    clientMessageId: 'second',
    sequence: 2,
    body: 'reply',
    createdAt: queued.createdAt,
  };
  const result = mergeMessages([queued], [second, saved, saved]);
  assert.deepEqual(
    result.map((x) => x.sequence),
    [1, 2],
  );
  assert.equal(
    mergeMessages(result, [{ ...queued, delivery: 'failed' }])[0].sequence,
    1,
  );
});
test('message identifiers remain valid and unique without browser randomUUID', () => {
  const ids = Array.from({ length: 100 }, () =>
    messageId((bytes) => crypto.webcrypto.getRandomValues(bytes)),
  );
  assert.equal(new Set(ids).size, 100);
  ids.forEach((id) =>
    assert.match(
      id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
  );
});
