const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  OtpDeliveryService,
} = require('../src/services/auth/otpDelivery.service.ts');
const original = { ...process.env };
afterEach(() => {
  for (const key of [
    'OTP_DELIVERY_MODE',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_MESSAGING_SERVICE_SID',
    'TWILIO_FROM_NUMBER',
    'NODE_ENV',
  ]) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});
function configure() {
  process.env.OTP_DELIVERY_MODE = 'twilio';
  process.env.TWILIO_ACCOUNT_SID = 'AC' + '1'.repeat(32);
  process.env.TWILIO_AUTH_TOKEN = 'test-only-token';
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG' + '2'.repeat(32);
}
test('Twilio sends a correctly addressed OTP without making a real SMS request', async () => {
  configure();
  let called = false;
  const service = new OtpDeliveryService(async (url, options) => {
    called = true;
    assert.ok(url.endsWith('/Messages.json'));
    assert.equal(options.method, 'POST');
    assert.equal(options.body.get('To'), '+919000000000');
    assert.ok(options.body.get('Body').includes('123456'));
    assert.equal(
      options.body.get('MessagingServiceSid'),
      process.env.TWILIO_MESSAGING_SERVICE_SID,
    );
    assert.ok(options.headers.Authorization.startsWith('Basic '));
    return new Response('{}', { status: 201 });
  });
  await service.send('+919000000000', '123456', 'SIGNUP');
  assert.ok(called);
});
test('SMS failures return a safe retry message', async () => {
  configure();
  const service = new OtpDeliveryService(
    async () => new Response('private provider details', { status: 400 }),
  );
  await assert.rejects(
    service.send('+919000000000', '123456', 'LOGIN'),
    /Unable to send your code/,
  );
});
test('missing provider credentials fail before any network request', async () => {
  configure();
  delete process.env.TWILIO_AUTH_TOKEN;
  let called = false;
  await assert.rejects(
    new OtpDeliveryService(async () => {
      called = true;
      return new Response();
    }).send('+919000000000', '123456', 'LOGIN'),
    /credentials/,
  );
  assert.equal(called, false);
});
test('production cannot use console OTP delivery', async () => {
  process.env.NODE_ENV = 'production';
  process.env.OTP_DELIVERY_MODE = 'console';
  await assert.rejects(
    new OtpDeliveryService().send('+919000000000', '123456', 'LOGIN'),
    /not configured/,
  );
});
