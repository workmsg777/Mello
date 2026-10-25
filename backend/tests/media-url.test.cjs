const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveMediaUrl } = require('../../frontend/src/config/media-url.ts');
const api = 'http://192.168.1.3:4000/api';
test('uploaded photos use the reachable API origin on a phone', () => {
  for (const path of [
    '/uploads/profile-photos/a.jpg',
    'uploads/profile-photos/a.jpg',
    'profile-photos/a.jpg',
  ])
    assert.equal(
      resolveMediaUrl(path, api, true),
      'http://192.168.1.3:4000/uploads/profile-photos/a.jpg',
    );
  assert.equal(
    resolveMediaUrl(
      'http://localhost:4000/uploads/profile-photos/a.jpg?v=1',
      api,
      true,
    ),
    'http://192.168.1.3:4000/uploads/profile-photos/a.jpg?v=1',
  );
});
test('CDN and picker image URLs are preserved', () => {
  for (const url of [
    'https://cdn.example.com/portrait.jpg',
    'file:///photo.jpg',
    'blob:photo',
    'data:image/png;base64,AAAA',
  ])
    assert.equal(resolveMediaUrl(url, api, true), url);
  assert.equal(resolveMediaUrl(null, api), undefined);
});
