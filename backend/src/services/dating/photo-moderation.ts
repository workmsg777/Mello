import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { matchingConfig } from '../../config/matching';
import { profilePhotoUploadDirectory } from '../../config/uploads';
import { rows } from '../../repositories/discovery.repository';

type Mode = 'shadow' | 'auto';
const maxBytes = 10 * 1024 * 1024;
const assessment = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('scored'),
    risk: z.number().min(0).max(1),
    model: z.string().max(100),
  }),
  z.object({ kind: z.literal('invalid') }),
]);

async function inspectPhoto(storageKey: string) {
  const filename = storageKey.match(
    /^profile-photos\/([a-z0-9_-]+\.(?:jpe?g|png|webp))$/i,
  )?.[1];
  if (!filename) return { kind: 'invalid' } as const;
  const file = path.join(profilePhotoUploadDirectory, filename);
  if ((await stat(file)).size > maxBytes) return { kind: 'invalid' } as const;
  const image = await readFile(file);
  if (image.length > maxBytes) return { kind: 'invalid' } as const;
  const response = await fetch(`${matchingConfig.aiUrl}/v1/photo-moderation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Service-Key': matchingConfig.aiKey,
    },
    body: new Uint8Array(image),
    signal: AbortSignal.timeout(12_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Photo moderation unavailable');
  return assessment.parse(await response.json());
}

export async function moderateNextPhoto(
  mode: Mode,
  approvalThreshold: number,
  inspect = inspectPhoto,
) {
  const claim = randomUUID();
  const [photo] = await rows<{
    id: string;
    storageKey: string;
    moderationAttempts: number;
  }>(
    `WITH next_photo AS (
      SELECT p.id,m.storage_key FROM user_photos p JOIN media m ON m.id=p.media_id
      WHERE p.deleted_at IS NULL AND m.deleted_at IS NULL AND m.storage_provider='LOCAL'
        AND m.storage_key LIKE 'profile-photos/%' AND p.moderation_status='PENDING'
        AND p.moderation_retry_at<=now() AND p.moderation_attempts<5
        AND (p.moderation_assessment IS NULL OR
             (:mode = 'auto' AND p.moderation_assessment->>'mode'='shadow'))
      ORDER BY p.moderation_retry_at,p.id LIMIT 1 FOR UPDATE OF p SKIP LOCKED
    )
    UPDATE user_photos p SET moderation_claim=:claim,moderation_retry_at=now()+interval '1 minute',
      moderation_attempts=p.moderation_attempts+1 FROM next_photo n WHERE p.id=n.id
    RETURNING p.id,n.storage_key AS "storageKey",p.moderation_attempts AS "moderationAttempts"`,
    { claim, mode },
  );
  if (!photo) return false;
  let decision: Record<string, unknown>;
  let approve = false;
  try {
    const result = await inspect(photo.storageKey);
    approve =
      mode === 'auto' &&
      result.kind === 'scored' &&
      result.risk <= approvalThreshold;
    decision = {
      ...result,
      mode,
      approvalThreshold,
      reviewedAt: new Date().toISOString(),
    };
  } catch {
    decision = {
      kind: 'unavailable',
      mode,
      reviewedAt: new Date().toISOString(),
    };
  }
  const failed = decision.kind === 'unavailable';
  await rows(
    `UPDATE user_photos SET moderation_claim=NULL,
      moderation_retry_at=now()+CAST(:retrySeconds AS integer)*interval '1 second',
      moderation_assessment=CASE WHEN :keepAssessment THEN CAST(:decision AS jsonb) ELSE moderation_assessment END,
      moderation_attempts=CASE WHEN :failed THEN moderation_attempts ELSE 0 END,
      moderation_status=CASE WHEN :approve THEN 'APPROVED' ELSE moderation_status END,
      updated_at=now() WHERE id=:id AND moderation_claim=:claim AND deleted_at IS NULL
        AND moderation_status='PENDING' RETURNING id`,
    {
      claim,
      id: photo.id,
      decision: JSON.stringify(decision),
      approve,
      failed,
      keepAssessment: !failed || photo.moderationAttempts >= 5,
      retrySeconds: failed ? 2 ** photo.moderationAttempts * 15 : 0,
    },
  );
  return true;
}

export function startPhotoModeration() {
  const mode = process.env.PHOTO_MODERATION_MODE ?? 'off';
  if (mode === 'off') return async () => {};
  const configuredThreshold = process.env.PHOTO_MODERATION_APPROVE_MAX_RISK;
  const approvalThreshold = Number(configuredThreshold ?? '0.01');
  if (
    (mode !== 'shadow' && mode !== 'auto') ||
    !matchingConfig.aiUrl ||
    matchingConfig.aiKey.length < 32 ||
    !Number.isFinite(approvalThreshold) ||
    approvalThreshold < 0 ||
    approvalThreshold >= 0.5 ||
    (mode === 'auto' && !configuredThreshold?.trim())
  )
    throw new Error(
      'Configure the photo moderation service and an explicit maximum risk for auto mode',
    );
  const stop = new AbortController();
  const run = async () => {
    while (!stop.signal.aborted) {
      try {
        if (await moderateNextPhoto(mode, approvalThreshold)) continue;
      } catch {
        console.error('Photo moderation queue is temporarily unavailable');
      }
      await delay(3000, undefined, { signal: stop.signal }).catch(() => {});
    }
  };
  const task = run();
  return async () => {
    stop.abort();
    await task;
  };
}
