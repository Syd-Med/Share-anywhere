import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/node';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    if (err.statusCode >= 500) {
      logger.error('AppError', { statusCode: err.statusCode, message: err.message, stack: err.stack });
    }
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ message: 'Internal server error' });
}
