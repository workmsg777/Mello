import type { RequestHandler } from 'express';
import { DiscoveryService } from '../services/discovery.service';

const discovery = new DiscoveryService();
export const requireDiscoveryReady: RequestHandler = async (
  req,
  _res,
  next,
) => {
  await discovery.assertReady(req.datingUserId!);
  next();
};
