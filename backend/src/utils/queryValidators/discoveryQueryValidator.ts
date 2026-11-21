import { z, type ZodType } from 'zod';
import Errors from '../../errors';

export function parseDiscovery<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Errors.BadRequestError(
      result.error.issues
        .map((x) => `${x.path.join('.')}: ${x.message}`)
        .join(', '),
    );
  return result.data;
}
export const discoveryId = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const paging = {
  limit: z.coerce.number().int().min(1).max(20).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
};
export const validateIncomingLikes = (raw: unknown) =>
  parseDiscovery(z.object(paging), raw);
export const validateDiscoveryAction = (raw: unknown) =>
  parseDiscovery(
    z
      .object({ targetId: discoveryId, action: z.enum(['LIKE', 'PASS']) })
      .strict(),
    raw,
  );
export const validateImpressions = (raw: unknown) =>
  parseDiscovery(
    z
      .object({
        feedSessionId: discoveryId,
        targetIds: z.array(discoveryId).min(1).max(20),
      })
      .strict(),
    raw,
  );
export function validateDiscoveryFeed(raw: unknown) {
  const input = parseDiscovery(
    z.object({
      ...paging,
      limit: paging.limit.default(10),
      shuffleSeed: discoveryId.optional(),
      after: discoveryId.optional(),
      feedSessionId: discoveryId.optional(),
      cursor: z.coerce.number().int().min(0).max(10000000).optional(),
    }),
    raw,
  );
  if (input.after && !input.shuffleSeed)
    throw new Errors.BadRequestError(
      'A shuffle seed is required with a discovery cursor',
    );
  if (
    (input.cursor !== undefined && !input.feedSessionId) ||
    (input.feedSessionId && (input.shuffleSeed || input.after || input.offset))
  )
    throw new Errors.BadRequestError(
      'Use a ranked session cursor or a shuffled cursor, not both',
    );
  return input;
}
export const validateChatHistory = (raw: unknown) =>
  parseDiscovery(
    z.object({
      matchId: discoveryId,
      before: z.coerce.number().int().positive().optional(),
    }),
    raw,
  );
export const validateChatMatchId = (raw: unknown) =>
  parseDiscovery(discoveryId, raw);
