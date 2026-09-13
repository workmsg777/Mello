import type { ErrorRequestHandler } from 'express';
import { CustomApiError } from '../errors';

interface ErrorLike {
  name?: string;
  message?: string;
  status?: number;
  statusCode?: number;
  errors?: Array<{ message?: string }> | Record<string, { message?: string }>;
  fields?: Record<string, unknown>;
  type?: string;
}

const asErrorLike = (error: unknown): ErrorLike =>
  error !== null && typeof error === 'object' ? (error as ErrorLike) : {};

const validationMessage = (errors: ErrorLike['errors']): string | undefined => {
  if (Array.isArray(errors)) {
    const messages = errors.map((item) => item.message).filter(Boolean);
    return messages.length > 0 ? messages.join(', ') : undefined;
  }
  if (errors) {
    const messages = Object.values(errors)
      .map((item) => item.message)
      .filter(Boolean);
    return messages.length > 0 ? messages.join(', ') : undefined;
  }
  return undefined;
};

/** Final Express error handler, adapted from Novixer's shared core middleware. */
export const errorHandle: ErrorRequestHandler = (error, req, res, next) => {
  if (res.writableEnded || req.destroyed) return;
  if (res.headersSent) {
    next(error);
    return;
  }

  const details = asErrorLike(error);
  let statusCode =
    error instanceof CustomApiError
      ? error.statusCode
      : (details.statusCode ?? details.status ?? 500);
  let message =
    error instanceof Error
      ? error.message
      : (details.message ?? 'Something went wrong; please try again later');

  if (details.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload is too large';
  }

  if (
    details.name === 'SequelizeValidationError' ||
    details.name === 'ValidationError'
  ) {
    statusCode = 400;
    message = validationMessage(details.errors) ?? message;
  }

  if (
    details.name === 'SequelizeUniqueConstraintError' ||
    details.name === 'UniqueConstraintError'
  ) {
    statusCode = 409;
    message =
      validationMessage(details.errors) ??
      (details.fields
        ? `Duplicate value entered for ${Object.keys(details.fields).join(', ')}`
        : 'Duplicate value entered');
  }

  if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  if (statusCode >= 500) {
    console.error('Unhandled server error:', error);
    if (process.env.NODE_ENV === 'production') {
      message = 'Something went wrong; please try again later';
    }
  }

  res.status(statusCode).json({ msg: message });
};
