import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { profilePhotoUploadDirectory } from './config/uploads';
import { errorHandle, notFound } from './middleware';
import { apiRouter } from './routes';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(
  '/uploads/profile-photos',
  express.static(profilePhotoUploadDirectory, {
    maxAge: '1h',
    immutable: false,
  }),
);
app.use('/api', apiRouter);

// Application routes must be registered above these terminal middleware handlers.
app.use(notFound);
app.use(errorHandle);
