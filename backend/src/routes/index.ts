import { Router } from 'express';
import { authRouter } from './auth.routes';
import { datingRouter } from './dating.routes';
import { discoveryRouter, partnerRouter } from './discovery.routes';
import { chatRouter } from './chat.routes';
import { notificationRouter } from './notification.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/dating', datingRouter);
apiRouter.use('/discovery', discoveryRouter);
apiRouter.use('/partner', partnerRouter);
apiRouter.use('/chat', chatRouter);
apiRouter.use('/notifications', notificationRouter);

export * from './auth.routes';
export * from './dating.routes';
