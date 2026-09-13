import type { RequestHandler } from 'express';
import Errors from '../errors';
import { TokenService } from '../services/auth/token.service';

const tokenService = new TokenService();

export const authenticate: RequestHandler = (req, _res, next) => {
  const authorization = req.header('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    throw new Errors.UnauthorizedError('Bearer access token is required');
  }

  req.auth = tokenService.verifyAccessToken(token);
  next();
};
