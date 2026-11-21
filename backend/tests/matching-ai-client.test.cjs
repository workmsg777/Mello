const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { MatchingAiClient } = require('../src/services/matching/ai-client.ts');

test('AI adapter authenticates, validates responses and falls back on malformed/unavailable services', async () => {
  const saved = {
    url: process.env.MATCHING_AI_URL,
    key: process.env.MATCHING_AI_KEY,
  };
  const candidate = randomUUID();
  let mode = 'valid';
  const server = http.createServer(async (req, res) => {
    assert.equal(req.headers['x-service-key'], 'a'.repeat(40));
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    assert.ok(!JSON.stringify(body).includes('phone'));
    if (mode === 'unavailable') {
      res.writeHead(503);
      res.end();
      return;
    }
    if (mode === 'oversized') {
      res.writeHead(200);
      res.end('x'.repeat(40_000));
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        modelVersion: 'test',
        scores: [
          {
            key: mode === 'unknown' ? randomUUID() : candidate,
            similarity: mode === 'invalid' ? 2 : 0.8,
          },
        ],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.MATCHING_AI_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.MATCHING_AI_KEY = 'a'.repeat(40);
    const client = new MatchingAiClient();
    const result = await client.semantic('hiking', [
      { key: candidate, text: 'mountains' },
    ]);
    assert.equal(result.scores.get(candidate), 0.8);
    for (mode of ['invalid', 'unknown', 'unavailable', 'oversized']) {
      assert.equal(
        await client.semantic('hiking', [
          { key: candidate, text: 'mountains' },
        ]),
        null,
      );
    }
    process.env.MATCHING_AI_KEY = '';
    assert.equal(
      await client.semantic('hiking', [{ key: candidate, text: 'mountains' }]),
      null,
    );
  } finally {
    if (saved.url === undefined) delete process.env.MATCHING_AI_URL;
    else process.env.MATCHING_AI_URL = saved.url;
    if (saved.key === undefined) delete process.env.MATCHING_AI_KEY;
    else process.env.MATCHING_AI_KEY = saved.key;
    await new Promise((resolve) => server.close(resolve));
  }
});
