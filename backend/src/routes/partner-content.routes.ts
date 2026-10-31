import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import Errors from '../errors';
import { PartnerRole } from '../constants/partner';
import { PartnerService } from '../services/partner.service';
import {
  PartnerContentService,
  partnerContentSchema,
} from '../services/partner-content.service';

export const partnerContentRouter = Router();
const partners = new PartnerService(),
  content = new PartnerContentService();
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw new Errors.BadRequestError(
      parsed.error.issues.map((issue) => issue.message).join(', '),
    );
  return parsed.data;
}
const id = z.string().uuid();
partnerContentRouter.get('/team', async (req, res) =>
  res.json(await partners.team(req.auth!.accountId)),
);
partnerContentRouter.post('/team', async (req, res) => {
  const input = parse(
    z.object({
      name: z.string().trim().min(1).max(200),
      phone: z.string().trim().min(8).max(32),
      role: z.literal(PartnerRole.SUPPORT),
    }),
    req.body,
  );
  res.status(201).json(await partners.addEmployee(req.auth!.accountId, input));
});
partnerContentRouter.patch('/team/:id', async (req, res) => {
  const input = parse(z.object({ enabled: z.boolean() }), req.body);
  res.json(
    await partners.setEmployeeEnabled(
      req.auth!.accountId,
      parse(id, req.params.id),
      input.enabled,
    ),
  );
});
partnerContentRouter.get('/content', async (req, res) =>
  res.json(await content.list(req.auth!.accountId)),
);
partnerContentRouter.post('/content', async (req, res) =>
  res
    .status(201)
    .json(
      await content.save(
        req.auth!.accountId,
        parse(partnerContentSchema, req.body),
      ),
    ),
);
partnerContentRouter.put('/content/:id', async (req, res) =>
  res.json(
    await content.save(
      req.auth!.accountId,
      parse(partnerContentSchema, req.body),
      parse(id, req.params.id),
    ),
  ),
);
partnerContentRouter.delete('/content/:id', async (req, res) => {
  await content.remove(req.auth!.accountId, parse(id, req.params.id));
  res.json({ success: true });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single('photo');
partnerContentRouter.post(
  '/photos',
  async (req, _res, next) => {
    await partners.authorize(req.auth!.accountId, 'manageContent');
    next();
  },
  (req, res, next) => {
    upload(req, res, (error) =>
      next(
        error instanceof multer.MulterError
          ? new Errors.BadRequestError(
              error.code === 'LIMIT_FILE_SIZE'
                ? 'Photo must be 10 MB or smaller'
                : error.message,
            )
          : error,
      ),
    );
  },
  async (req, res) =>
    res.status(201).json(await content.upload(req.auth!.accountId, req.file)),
);
