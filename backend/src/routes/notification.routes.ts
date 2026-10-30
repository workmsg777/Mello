import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middleware/authenticate';
import Errors from '../errors';
import { rows } from '../repositories/discovery.repository';
import { NotificationService } from '../notifications/notification.service';
import { notificationColumns } from '../notifications/types';
import { sequelize } from '../config/database';

export const notificationRouter = Router();
const service = new NotificationService();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Errors.BadRequestError(
      result.error.issues.map((i) => i.message).join(', '),
    );
  return result.data;
}
notificationRouter.use(authenticate);
notificationRouter.get('/', async (req, res) => {
  const q = parse(
    z
      .object({
        at: z.string().datetime({ offset: true }).optional(),
        id: z.string().uuid().optional(),
      })
      .refine((x) => !!x.at === !!x.id, 'Provide both cursor fields'),
    req.query,
  );
  res.json(
    await service.list(
      req.auth!.accountId,
      q.at && q.id ? { at: q.at, id: q.id } : undefined,
    ),
  );
});
notificationRouter.get('/preferences', async (req, res) =>
  res.json(await service.preferences(req.auth!.accountId)),
);
notificationRouter.put('/preferences', async (req, res) => {
  const input = parse(
    z
      .object({
        messages: z.boolean(),
        dates: z.boolean(),
        matches: z.boolean(),
        likes: z.boolean(),
        offers: z.boolean(),
        push: z.boolean(),
      })
      .strict(),
    req.body,
  );
  await rows(
    `INSERT INTO notification_preferences(account_id,messages,dates,matches,likes,offers,push) VALUES (:accountId,:messages,:dates,:matches,:likes,:offers,:push)
    ON CONFLICT(account_id) DO UPDATE SET messages=EXCLUDED.messages,dates=EXCLUDED.dates,matches=EXCLUDED.matches,likes=EXCLUDED.likes,offers=EXCLUDED.offers,push=EXCLUDED.push,updated_at=now() RETURNING account_id`,
    { accountId: req.auth!.accountId, ...input },
  );
  res.json(await service.preferences(req.auth!.accountId));
});
notificationRouter.post('/read', async (req, res) => {
  const input = parse(
    z.union([
      z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict(),
      z.object({ before: z.string().datetime({ offset: true }) }).strict(),
    ]),
    req.body,
  );
  await service.markRead(
    req.auth!.accountId,
    'ids' in input ? input.ids : null,
    'before' in input ? input.before : undefined,
  );
  res.json({ success: true });
});
notificationRouter.post('/devices', async (req, res) => {
  const input = parse(
    z.object({
      app: z.enum(['USER', 'PARTNER']),
      provider: z.enum(['EXPO', 'FCM', 'APNS']).default('EXPO'),
      token: z.string().min(10).max(2048),
      projectId: z.string().uuid(),
      platform: z.enum(['android', 'ios']),
    }),
    req.body,
  );
  if (
    input.provider === 'EXPO' &&
    !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(input.token)
  )
    throw new Errors.BadRequestError('Invalid Expo push token');
  if (
    input.provider === 'FCM' &&
    (input.platform !== 'android' || !/^[A-Za-z0-9_:\-]+$/.test(input.token))
  )
    throw new Errors.BadRequestError('Invalid Android device token');
  if (
    input.provider === 'APNS' &&
    (input.platform !== 'ios' || !/^[0-9a-fA-F]{64}$/.test(input.token))
  )
    throw new Errors.BadRequestError('Invalid Apple device token');
  if (
    (input.app === 'USER' ? 'DATING_USER' : 'PARTNER_USER') !==
    req.auth!.accountType
  )
    throw new Errors.ForbiddenError(
      'This push device belongs to a different app',
    );
  const project =
    process.env[
      input.app === 'USER'
        ? 'NOTIFICATION_USER_PROJECT_ID'
        : 'NOTIFICATION_PARTNER_PROJECT_ID'
    ];
  if (!project || project !== input.projectId)
    throw new Errors.BadRequestError(
      'Phone push is not configured for this app project',
    );
  const device = await sequelize.transaction(async (transaction) => {
    await rows(
      'SELECT id FROM accounts WHERE id=:accountId FOR UPDATE',
      { accountId: req.auth!.accountId },
      transaction,
    );
    await rows(
      `UPDATE notification_devices SET enabled=false WHERE account_id=:accountId AND session_id=:sessionId AND app=:app AND provider<>:provider RETURNING id`,
      { ...req.auth, ...input },
      transaction,
    );
    const [registered] = await rows<{ id: string }>(
      `INSERT INTO notification_devices(id,account_id,session_id,app,token,provider,project_id,platform)
    VALUES (:id,:accountId,:sessionId,:app,:token,:provider,:projectId,:platform) ON CONFLICT(app,provider,token) DO UPDATE
    SET account_id=EXCLUDED.account_id,session_id=EXCLUDED.session_id,enabled=true,project_id=EXCLUDED.project_id,updated_at=now() RETURNING id`,
      { ...input, id: randomUUID(), ...req.auth },
      transaction,
    );
    await rows(
      `UPDATE notification_devices SET enabled=false WHERE id IN (
      SELECT id FROM notification_devices WHERE account_id=:accountId AND enabled ORDER BY updated_at DESC,id DESC OFFSET 10
    ) RETURNING id`,
      { accountId: req.auth!.accountId },
      transaction,
    );
    return registered;
  });
  res.status(201).json(device);
});
notificationRouter.delete('/devices/:id', async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  await rows(
    'UPDATE notification_devices SET enabled=false WHERE id=:id AND account_id=:accountId RETURNING id',
    { id, accountId: req.auth!.accountId },
  );
  res.json({ success: true });
});
notificationRouter.get('/:id', async (req, res) => {
  const id = parse(z.string().uuid(), req.params.id);
  const [item] = await rows(
    `SELECT ${notificationColumns} FROM notifications WHERE id=:id AND account_id=:accountId`,
    { id, accountId: req.auth!.accountId },
  );
  if (!item) throw new Errors.NotFoundError('Notification not found');
  res.json(item);
});
