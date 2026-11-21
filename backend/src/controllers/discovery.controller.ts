import type { RequestHandler } from 'express';
import { DiscoveryService } from '../services/discovery.service';
import { publishChat } from '../realtime/chat-events';
import {
  validateDiscoveryAction,
  validateDiscoveryFeed,
  validateIncomingLikes,
  validateImpressions,
} from '../utils/queryValidators/discoveryQueryValidator';

const discovery = new DiscoveryService();
export const getDiscoveryFeed: RequestHandler = async (req, res) => {
  const input = validateDiscoveryFeed(req.query);
  res.json(
    await discovery.feed(req.datingUserId!, input.limit, input.offset, input),
  );
};
export const saveDiscoveryImpressions: RequestHandler = async (req, res) => {
  const input = validateImpressions(req.body);
  res.json({
    recorded: await discovery.impressions(
      req.datingUserId!,
      input.feedSessionId,
      input.targetIds,
    ),
  });
};
export const saveDiscoveryAction: RequestHandler = async (req, res) => {
  const input = validateDiscoveryAction(req.body);
  const result = await discovery.act(
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
};
export const getIncomingLikes: RequestHandler = async (req, res) => {
  const input = validateIncomingLikes(req.query);
  res.json(
    await discovery.incomingLikes(req.datingUserId!, input.limit, input.offset),
  );
};
export const getDiscoveryMatches: RequestHandler = async (req, res) => {
  res.json(await discovery.matches(req.datingUserId!));
};
