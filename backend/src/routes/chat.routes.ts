import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireDatingUser } from '../middleware/requireDatingUser';
import { requireDiscoveryReady } from '../middleware/requireDiscoveryReady';
import {
  getConversations,
  getIcebreakers,
  getChatHistory,
  sendChatMessage,
  readChatMessage,
} from '../controllers/chat.controller';

export const chatRouter = Router();
chatRouter.use(authenticate, requireDatingUser, requireDiscoveryReady);
chatRouter.get('/conversations', getConversations);
chatRouter.post('/:matchId/icebreakers', getIcebreakers);
chatRouter.get('/:matchId/messages', getChatHistory);
chatRouter.post('/:matchId/messages', sendChatMessage);
chatRouter.post('/:matchId/read', readChatMessage);
