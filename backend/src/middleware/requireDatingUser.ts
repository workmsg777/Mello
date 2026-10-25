import type { RequestHandler } from 'express';
import Errors from '../errors';
import { DatingUserService } from '../services/dating';

const datingUserService = new DatingUserService();

export const requireDatingUser: RequestHandler = async (req, _res, next) => {
  if (!req.auth)
    throw new Errors.UnauthorizedError('Authentication is required');
  if (req.auth.accountType !== 'DATING_USER')
    throw new Errors.ForbiddenError('Dating-user access is required');
  const user = await datingUserService.requireByAccountId(req.auth.accountId);
  req.datingUserId = user.id;
  next();
};
