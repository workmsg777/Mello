const { test } = require('node:test');
const assert = require('node:assert/strict');
const modules = [
  ['dating app', '../../frontend/src/config/api-url.ts'],
  ['partner app', '../../frontend/apps/partner/src/config/api-url.ts'],
];
for (const [name, file] of modules) {
  const { resolveApiBaseUrl } = require(file);
  const dev = {
    platform: 'android',
    isDevelopment: true,
    expoHostUri: '192.168.1.3:8081',
  };
  test(`${name}: physical phone uses the Expo computer instead of localhost`, () => {
    assert.equal(resolveApiBaseUrl(dev), 'http://192.168.1.3:4000/api');
    for (const hostname of ['localhost', '127.0.0.1', '[::1]', '0.0.0.0']) {
      assert.equal(
        resolveApiBaseUrl({
          ...dev,
          configuredUrl: `http://${hostname}:4555/api/`,
        }),
        'http://192.168.1.3:4555/api',
      );
    }
  });
  test(`${name}: explicit remote APIs and production configuration are preserved`, () => {
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        configuredUrl: 'https://api.example.com/v1/',
      }),
      'https://api.example.com/v1',
    );
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        isDevelopment: false,
        configuredUrl: 'https://api.example.com/api',
      }),
      'https://api.example.com/api',
    );
    assert.equal(
      resolveApiBaseUrl({ ...dev, isDevelopment: false }),
      'http://localhost:4000/api',
    );
  });
  test(`${name}: browser uses its own host and respects an explicit URL`, () => {
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        platform: 'web',
        browserHostname: 'localhost',
      }),
      'http://localhost:4000/api',
    );
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        platform: 'web',
        browserHostname: '192.168.1.3',
      }),
      'http://192.168.1.3:4000/api',
    );
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        platform: 'web',
        configuredUrl: 'http://localhost:4555/api',
      }),
      'http://localhost:4555/api',
    );
  });
  test(`${name}: missing or tunnel metadata does not invent an API tunnel`, () => {
    assert.equal(
      resolveApiBaseUrl({ ...dev, expoHostUri: null }),
      'http://localhost:4000/api',
    );
    assert.equal(
      resolveApiBaseUrl({
        ...dev,
        expoHostUri: 'project.exp.direct:80',
        configuredUrl: 'https://api.example.com/api',
      }),
      'https://api.example.com/api',
    );
    assert.equal(
      resolveApiBaseUrl({ ...dev, expoHostUri: 'exp://10.0.0.9:8082' }),
      'http://10.0.0.9:4000/api',
    );
  });
}
