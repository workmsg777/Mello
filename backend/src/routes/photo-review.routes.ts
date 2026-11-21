import { Router } from 'express';
import { z } from 'zod';
import Errors from '../errors';
import { authenticate } from '../middleware/authenticate';
import { rows } from '../repositories/discovery.repository';
import { reviewProfilePhoto } from './profile-photo-files';

const decision = z
  .object({ status: z.enum(['APPROVED', 'REJECTED']) })
  .strict();
const uuid = z.string().uuid();

export const photoReviewRouter = Router();

photoReviewRouter.use(authenticate, async (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const auth = req.auth;
  if (!auth || auth.accountType !== 'PLATFORM_USER')
    throw new Errors.ForbiddenError('Mello reviewer access is required');
  const [reviewer] = await rows(
    `SELECT 1 FROM account_roles ar JOIN roles r ON r.id=ar.role_id
     JOIN platform_users p ON p.account_id=ar.account_id AND p.deleted_at IS NULL
     WHERE ar.account_id=:accountId AND r.code IN ('ADMIN', 'SUPERADMIN') LIMIT 1`,
    { accountId: auth.accountId },
  );
  if (!reviewer)
    throw new Errors.ForbiddenError('Mello reviewer access is required');
  next();
});

photoReviewRouter.get('/', async (_req, res) => {
  const photos = await rows(
    `SELECT p.id, p.created_at AS "uploadedAt",
      jsonb_build_object('kind',p.moderation_assessment->>'kind',
        'risk',p.moderation_assessment->'risk') AS assessment
     FROM user_photos p JOIN media m ON m.id=p.media_id AND m.deleted_at IS NULL
     JOIN users u ON u.id=p.user_id AND u.deleted_at IS NULL
     WHERE p.deleted_at IS NULL AND p.moderation_status='PENDING'
       AND m.storage_provider='LOCAL' AND m.storage_key LIKE 'profile-photos/%'
     ORDER BY p.created_at,p.id LIMIT 20`,
  );
  res.json({ photos });
});

photoReviewRouter.get('/:id/file', reviewProfilePhoto);

photoReviewRouter.patch('/:id', async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  const input = decision.safeParse(req.body);
  if (!id.success || !input.success)
    throw new Errors.BadRequestError(
      'Choose an approval or rejection for a valid photo',
    );
  const [reviewed] = await rows(
    `UPDATE user_photos p SET moderation_status=:status, moderation_claim=NULL,
      moderation_assessment=COALESCE(p.moderation_assessment,'{}'::jsonb) ||
        jsonb_build_object('manualReview',jsonb_build_object('accountId',CAST(:accountId AS uuid),
          'status',CAST(:status AS text),'reviewedAt',now())), updated_at=now()
     FROM media m, users u WHERE p.id=:id AND p.media_id=m.id AND p.user_id=u.id
       AND p.deleted_at IS NULL AND p.moderation_status='PENDING'
       AND m.deleted_at IS NULL AND u.deleted_at IS NULL AND m.storage_provider='LOCAL'
       AND m.storage_key LIKE 'profile-photos/%'
     RETURNING p.id,p.moderation_status AS status`,
    { id: id.data, status: input.data.status, accountId: req.auth!.accountId },
  );
  if (!reviewed)
    throw new Errors.ConflictError('This photo is no longer awaiting review');
  res.json(reviewed);
});
