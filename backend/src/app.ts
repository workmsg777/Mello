import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { publicProfilePhoto } from './routes/profile-photo-files';
import { errorHandle, notFound } from './middleware';
import { apiRouter } from './routes';
import path from 'node:path';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.get('/uploads/profile-photos/:id', publicProfilePhoto);
app.use('/api', apiRouter);
app.use(
  '/uploads/partner-photos',
  express.static(path.resolve('uploads/partner-photos'), {
    maxAge: '1h',
    setHeaders: (res) =>
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
);

// Application routes must be registered above these terminal middleware handlers.
app.use(notFound);
app.use(errorHandle);
