import type { RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ msg: `Route not found: ${req.method} ${req.originalUrl}` });
};
