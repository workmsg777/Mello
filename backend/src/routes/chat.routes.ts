import { Router } from 'express';
import { z } from 'zod';
import Errors from '../errors';
import { authenticate } from '../middleware/authenticate';
import { requireDatingUser } from '../middleware/requireDatingUser';
import { ChatService } from '../services/chat.service';
import { DiscoveryService } from '../services/discovery.service';
import { publishChat } from '../realtime/chat-events';

export const chatRouter = Router();
const chat = new ChatService(),
  discovery = new DiscoveryService();
chatRouter.use(authenticate, requireDatingUser, async (req, _res, next) => {
  await discovery.assertReady(req.datingUserId!);
  next();
});
chatRouter.get('/conversations', async (req, res) => {
  res.json(await chat.summaries(req.datingUserId!));
});
chatRouter.get('/:matchId/messages', async (req, res) => {
  const input = z
    .object({
      matchId: z.string().uuid(),
      before: z.coerce.number().int().positive().optional(),
    })
    .safeParse({ matchId: req.params.matchId, before: req.query.before });
  if (!input.success)
    throw new Errors.BadRequestError('Invalid conversation or cursor');
  res.json(
    await chat.history(
      req.datingUserId!,
      input.data.matchId,
      input.data.before,
    ),
  );
});
chatRouter.post('/:matchId/messages', async (req, res) => {
  const result = await chat.send(req.datingUserId!, {
    ...req.body,
    matchId: req.params.matchId,
  });
  publishChat(
    [req.datingUserId!, result.peerId],
    'chat:message',
    result.message,
  );
  res.status(result.duplicate ? 200 : 201).json(result.message);
});
chatRouter.post('/:matchId/read', async (req, res) => {
  const { peerId, ...receipt } = await chat.read(req.datingUserId!, {
    ...req.body,
    matchId: req.params.matchId,
  });
  publishChat([req.datingUserId!, peerId], 'chat:read', receipt);
  res.json(receipt);
});
