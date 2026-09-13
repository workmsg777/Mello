import type { Request, RequestHandler } from 'express';
import Errors from '../errors';
import { AuthenticationService } from '../services/auth/authentication.service';
import type { RequestMetadata } from '../types/auth';
import {
  validateLoginRequestOtp,
  validateLoginVerify,
  validateRefreshToken,
  validateSignupRequestOtp,
  validateSignupVerify,
} from '../utils/queryValidators/authQueryValidator';

const authenticationService = new AuthenticationService();

const requestMetadata = (req: Request): RequestMetadata => ({
  ...(req.ip ? { ipAddress: req.ip } : {}),
  ...(req.get('user-agent') ? { userAgent: req.get('user-agent') } : {}),
});

export const requestSignupOtp: RequestHandler = async (req, res) => {
  const input = validateSignupRequestOtp(req.body);
  const result = await authenticationService.requestSignupOtp(
    input.phone,
    input.accountType,
  );
  res.status(202).json(result);
};

export const verifySignup: RequestHandler = async (req, res) => {
  const input = validateSignupVerify(req.body);
  const result = await authenticationService.verifySignup(
    input,
    requestMetadata(req),
  );
  res.status(201).json(result);
};

export const requestLoginOtp: RequestHandler = async (req, res) => {
  const input = validateLoginRequestOtp(req.body);
  const result = await authenticationService.requestLoginOtp(input.phone);
  res.status(202).json(result);
};

export const verifyLogin: RequestHandler = async (req, res) => {
  const input = validateLoginVerify(req.body);
  const result = await authenticationService.verifyLogin(
    input,
    requestMetadata(req),
  );
  res.status(200).json(result);
};

export const refreshAccessToken: RequestHandler = async (req, res) => {
  const input = validateRefreshToken(req.body);
  const result = await authenticationService.refresh(
    input.refreshToken,
    requestMetadata(req),
  );
  res.status(200).json(result);
};

export const logout: RequestHandler = async (req, res) => {
  const input = validateRefreshToken(req.body);
  await authenticationService.logout(input.refreshToken);
  res.status(204).send();
};

export const getCurrentAccount: RequestHandler = async (req, res) => {
  if (!req.auth) {
    throw new Errors.UnauthorizedError('Authentication is required');
  }
  const result = await authenticationService.me(req.auth);
  res.status(200).json(result);
};
