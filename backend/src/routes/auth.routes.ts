import { Router } from 'express';
import {
  getCurrentAccount,
  logout,
  refreshAccessToken,
  requestLoginOtp,
  requestSignupOtp,
  verifyLogin,
  verifySignup,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

export const authRouter = Router();

authRouter.post('/signup/request-otp', requestSignupOtp);
authRouter.post('/signup/verify', verifySignup);
authRouter.post('/login/request-otp', requestLoginOtp);
authRouter.post('/login/verify', verifyLogin);
authRouter.post('/refresh', refreshAccessToken);
authRouter.post('/logout', logout);
authRouter.get('/me', authenticate, getCurrentAccount);
