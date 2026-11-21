import type { RequestHandler } from 'express';
import { ChatService } from '../services/chat.service';
import { publishChat } from '../realtime/chat-events';
import {
  validateChatHistory,
  validateChatMatchId,
} from '../utils/queryValidators/discoveryQueryValidator';

const chat = new ChatService();
export const getConversations: RequestHandler = async (req, res) => {
  res.json(await chat.summaries(req.datingUserId!));
};
export const getIcebreakers: RequestHandler = async (req, res) => {
  res.json(
    await chat.icebreakers(
      req.datingUserId!,
      validateChatMatchId(req.params.matchId),
    ),
  );
};
export const getChatHistory: RequestHandler = async (req, res) => {
  const input = validateChatHistory({
    matchId: req.params.matchId,
    before: req.query.before,
  });
  res.json(await chat.history(req.datingUserId!, input.matchId, input.before));
};
export const sendChatMessage: RequestHandler = async (req, res) => {
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
};
export const readChatMessage: RequestHandler = async (req, res) => {
  const { peerId, ...receipt } = await chat.read(req.datingUserId!, {
    ...req.body,
    matchId: req.params.matchId,
  });
  publishChat([req.datingUserId!, peerId], 'chat:read', receipt);
  res.json(receipt);
};
