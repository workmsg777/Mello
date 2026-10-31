import { readFile } from 'node:fs/promises';
import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
export interface NativePush {
  provider: 'FCM' | 'APNS';
  app: 'USER' | 'PARTNER';
  token: string;
  notificationId: string;
  offers: boolean;
}
export interface NativePushResult {
  accepted: boolean;
  invalidDevice?: boolean;
  error?: string;
}
const googleTokens = new Map<
  string,
  { token: string; expires: number; project: string }
>();
const pendingGoogleTokens = new Map<
  string,
  Promise<{ token: string; project: string }>
>();
const appleSessions = new Map<string, http2.ClientHttp2Session>();
let appleJwt: { token: string; expires: number } | undefined;
async function googleToken(app: string) {
  const existing = pendingGoogleTokens.get(app);
  if (existing) return existing;
  const pending = (async () => {
    const cached = googleTokens.get(app);
    if (cached && cached.expires > Date.now())
      return { token: cached.token, project: cached.project };
    const filename = process.env[`FCM_${app}_SERVICE_ACCOUNT_FILE`];
    if (!filename) throw new Error('FCM_NOT_CONFIGURED');
    const credential = JSON.parse(await readFile(filename, 'utf8')) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };
    const assertion = jwt.sign(
      { scope: 'https://www.googleapis.com/auth/firebase.messaging' },
      credential.private_key,
      {
        algorithm: 'RS256',
        issuer: credential.client_email,
        audience: 'https://oauth2.googleapis.com/token',
        expiresIn: 3600,
      },
    );
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('FCM_AUTH_FAILED');
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) throw new Error('FCM_AUTH_FAILED');
    googleTokens.set(app, {
      token: data.access_token,
      project: credential.project_id,
      expires:
        Date.now() + (Math.min(data.expires_in ?? 3600, 3600) - 120) * 1000,
    });
    return { token: data.access_token, project: credential.project_id };
  })();
  pendingGoogleTokens.set(app, pending);
  try {
    return await pending;
  } finally {
    pendingGoogleTokens.delete(app);
  }
}
async function fcm(message: NativePush): Promise<NativePushResult> {
  const auth = await googleToken(message.app);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.project)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        message: {
          token: message.token,
          notification: {
            title: 'Mello',
            body: message.offers
              ? 'There’s something new nearby. Open Mello to explore.'
              : 'You have a new update. Open Mello to see it.',
          },
          data: { notificationId: message.notificationId },
          android: {
            priority: 'high',
            ttl: '86400s',
            notification: {
              channel_id: 'mello-updates',
              tag: message.notificationId,
            },
          },
        },
      }),
    },
  );
  if (response.ok) return { accepted: true };
  if (response.status === 401) googleTokens.delete(message.app);
  const data = (await response.json()) as {
    error?: { details?: { errorCode?: string }[] };
  };
  if (data.error?.details?.some((d) => d.errorCode === 'UNREGISTERED'))
    return { accepted: false, invalidDevice: true };
  return { accepted: false, error: `FCM_HTTP_${response.status}` };
}
async function apns(message: NativePush): Promise<NativePushResult> {
  const topic = process.env[`APNS_${message.app}_TOPIC`];
  const keyId = process.env.APNS_KEY_ID,
    teamId = process.env.APNS_TEAM_ID,
    keyFile = process.env.APNS_KEY_FILE;
  if (!topic || !keyId || !teamId || !keyFile)
    throw new Error('APNS_NOT_CONFIGURED');
  if (!appleJwt || appleJwt.expires < Date.now())
    appleJwt = {
      token: jwt.sign({}, await readFile(keyFile, 'utf8'), {
        algorithm: 'ES256',
        keyid: keyId,
        issuer: teamId,
      }),
      expires: Date.now() + 45 * 60000,
    };
  const origin =
    process.env.APNS_SANDBOX === 'true'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  let session = appleSessions.get(origin);
  if (!session || session.closed || session.destroyed) {
    session = http2.connect(origin);
    appleSessions.set(origin, session);
    session.on('error', () => {
      session?.destroy();
      appleSessions.delete(origin);
    });
    session.on('goaway', () => {
      session?.close();
      appleSessions.delete(origin);
    });
  }
  const connection = session;
  return new Promise((resolve, reject) => {
    let status = 0,
      body = '';
    const request = connection.request({
      ':method': 'POST',
      ':path': `/3/device/${message.token}`,
      authorization: `bearer ${appleJwt!.token}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
      'apns-collapse-id': message.notificationId,
    });
    request.setEncoding('utf8');
    request.setTimeout(8000, () => request.destroy(new Error('APNS_TIMEOUT')));
    request.on('response', (headers) => {
      status = Number(headers[':status']);
    });
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('error', reject);
    request.on('end', () => {
      if (status === 200) return resolve({ accepted: true });
      let reason = '';
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? '';
      } catch {}
      if (reason === 'ExpiredProviderToken') appleJwt = undefined;
      if (
        status === 410 ||
        reason === 'BadDeviceToken' ||
        reason === 'DeviceTokenNotForTopic'
      )
        return resolve({ accepted: false, invalidDevice: true });
      resolve({ accepted: false, error: `APNS_HTTP_${status}` });
    });
    request.end(
      JSON.stringify({
        aps: {
          alert: {
            title: 'Mello',
            body: message.offers
              ? 'There’s something new nearby. Open Mello to explore.'
              : 'You have a new update. Open Mello to see it.',
          },
          sound: 'default',
        },
        notificationId: message.notificationId,
      }),
    );
  });
}
export async function sendNativePush(
  message: NativePush,
): Promise<NativePushResult> {
  return message.provider === 'FCM' ? fcm(message) : apns(message);
}
export function closeNativePushConnections() {
  for (const connection of appleSessions.values()) connection.close();
  appleSessions.clear();
}
