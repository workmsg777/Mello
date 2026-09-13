import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandle, notFound } from './middleware';

export const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));

// Application routes must be registered above these terminal middleware handlers.
app.use(notFound);
app.use(errorHandle);
