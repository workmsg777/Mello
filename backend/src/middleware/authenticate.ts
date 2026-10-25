import type { RequestHandler } from 'express';
import Errors from '../errors';
import { TokenService } from '../services/auth/token.service';
import { Op } from 'sequelize';
import { Account, UserSession } from '../models';

const tokenService = new TokenService();

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    throw new Errors.UnauthorizedError('Bearer access token is required');
  }

  req.auth = tokenService.verifyAccessToken(token);
  const [account, session] = await Promise.all([
    Account.findOne({ where: { id: req.auth.accountId, status: 'ACTIVE' } }),
    UserSession.findOne({
      where: {
        id: req.auth.sessionId,
        accountId: req.auth.accountId,
        revokedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    }),
  ]);
  if (!account || !session)
    throw new Errors.UnauthorizedError(
      'Your session has ended. Please log in again.',
    );
  next();
};
