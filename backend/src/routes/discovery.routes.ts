import { Router, type RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import Errors from '../errors';
import { authenticate } from '../middleware/authenticate';
import { requireDatingUser } from '../middleware/requireDatingUser';
import { DiscoveryService } from '../services/discovery.service';
import { PartnerService } from '../services/partner.service';
import { publishChat } from '../realtime/chat-events';
import { partnerCatalog } from '../constants/partner';
import { partnerContentRouter } from './partner-content.routes';
import { PartnerContentService } from '../services/partner-content.service';

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Errors.BadRequestError(
      result.error.issues
        .map((x) => `${x.path.join('.')}: ${x.message}`)
        .join(', '),
    );
  return result.data;
}
const service = new DiscoveryService();
const partner = new PartnerService();
const id = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const ready: RequestHandler = async (req, _res, next) => {
  await service.assertReady(req.datingUserId!);
  next();
};
export const discoveryRouter = Router();
discoveryRouter.use(authenticate, requireDatingUser, ready);
discoveryRouter.get('/feed', async (req, res) => {
  const q = parse(
    z.object({
      limit: z.coerce.number().int().min(1).max(20).default(10),
      offset: z.coerce.number().int().min(0).max(10000).default(0),
      shuffleSeed: z.string().uuid().optional(),
      after: z.string().uuid().optional(),
    }),
    req.query,
  );
  if (q.after && !q.shuffleSeed)
    throw new Errors.BadRequestError(
      'A shuffle seed is required with a discovery cursor',
    );
  res.json(await service.feed(req.datingUserId!, q.limit, q.offset, q));
});
discoveryRouter.post('/actions', async (req, res) => {
  const input = parse(
    z.object({ targetId: id, action: z.enum(['LIKE', 'PASS']) }),
    req.body,
  );
  const result = await service.act(
    req.datingUserId!,
    input.targetId,
    input.action,
  );
  if (result.matched)
    publishChat([req.datingUserId!, input.targetId], 'chat:matched', {
      matchId: result.matchId,
    });
  else if (input.action === 'LIKE')
    publishChat([input.targetId], 'discovery:liked', {});
  res.json(result);
});

discoveryRouter.get('/likes', async (req, res) => {
  const q = parse(
    z.object({
      limit: z.coerce.number().int().min(1).max(20).default(20),
      offset: z.coerce.number().int().min(0).max(10000).default(0),
    }),
    req.query,
  );
  res.json(await service.incomingLikes(req.datingUserId!, q.limit, q.offset));
});
discoveryRouter.get('/matches', async (req, res) => {
  res.json(await service.matches(req.datingUserId!));
});
discoveryRouter.get('/venues', async (req, res) => {
  const input = parse(
    z.object({ kind: z.enum(['CAFE', 'RESTAURANT', 'ACTIVITY']).optional() }),
    req.query,
  );
  res.json(await service.venues(req.datingUserId!, input.kind));
});
discoveryRouter.get('/matches/:matchId/plans', async (req, res) => {
  res.json(
    await service.plans(req.datingUserId!, parse(id, req.params.matchId)),
  );
});
discoveryRouter.post('/matches/:matchId/plans', async (req, res) => {
  const input = parse(
    z.object({
      partnerId: id,
      proposedAt: z
        .string()
        .datetime({ offset: true })
        .refine((x) => {
          const time = new Date(x).getTime();
          return (
            time > Date.now() + 15 * 60000 && time < Date.now() + 180 * 86400000
          );
        }, 'Choose a time at least 15 minutes ahead and within 180 days'),
      note: z.string().trim().max(500).default(''),
    }),
    req.body,
  );
  res
    .status(201)
    .json(
      await service.propose(
        req.datingUserId!,
        parse(id, req.params.matchId),
        input,
      ),
    );
});
discoveryRouter.patch('/matches/:matchId/plans/:planId', async (req, res) => {
  const input = parse(
    z.object({ status: z.enum(['ACCEPTED', 'DECLINED', 'CANCELLED']) }),
    req.body,
  );
  await service.respond(
    req.datingUserId!,
    parse(id, req.params.matchId),
    parse(id, req.params.planId),
    input.status,
  );
  res.json({ success: true });
});

export const partnerRouter = Router();
partnerRouter.get('/catalog', (_req, res) => res.json(partnerCatalog()));
partnerRouter.use(authenticate, (req, _res, next) => {
  if (req.auth?.accountType !== 'PARTNER_USER')
    throw new Errors.ForbiddenError('Partner access is required');
  next();
});
partnerRouter.get('/workspace', async (req, res) => {
  res.json(await partner.get(req.auth!.accountId));
});
partnerRouter.use(partnerContentRouter);
discoveryRouter.get('/venues/:partnerId/content', async (req, res) => {
  res.json(
    await new PartnerContentService().published(
      parse(id, req.params.partnerId),
    ),
  );
});
partnerRouter.put('/listing', async (req, res) => {
  const input = parse(
    z
      .object({
        name: z.string().trim().min(1).max(200),
        description: z.string().trim().max(5000),
        address: z.string().trim().min(1).max(255),
        city: z.string().trim().min(1).max(120),
        state: z.string().trim().min(1).max(120),
        postalCode: z.string().trim().min(1).max(20),
        kind: z.enum(['CAFE', 'RESTAURANT', 'ACTIVITY']),
        headline: z.string().trim().min(5).max(160),
        imageUrl: z
          .string()
          .url()
          .refine((x) => x.startsWith('https://'), 'Use an HTTPS image URL')
          .max(2000)
          .nullable(),
        priceForTwoInr: z.number().int().min(0).max(1000000).nullable(),
        durationMinutes: z.number().int().min(15).max(1440),
        tags: z.array(z.string().trim().min(1).max(30)).max(6),
        isPublished: z.boolean(),
        latitude: z.number().min(-90).max(90).nullable(),
        longitude: z.number().min(-180).max(180).nullable(),
      })
      .refine(
        (x) => (x.latitude === null) === (x.longitude === null),
        'Provide both coordinates or neither',
      ),
    req.body,
  );
  res.json(await partner.save(req.auth!.accountId, input));
});
partnerRouter.get('/requests', async (req, res) => {
  res.json(await partner.requests(req.auth!.accountId));
});
partnerRouter.patch('/requests/:id', async (req, res) => {
  const input = parse(
    z.object({ status: z.enum(['CONFIRMED', 'DECLINED']) }),
    req.body,
  );
  await partner.respond(
    req.auth!.accountId,
    parse(id, req.params.id),
    input.status,
  );
  res.json({ success: true });
});
