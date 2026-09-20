import { Router } from 'express';
import { authRouter } from './auth.routes';
import { datingRouter } from './dating.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/dating', datingRouter);

export * from './auth.routes';
export * from './dating.routes';
