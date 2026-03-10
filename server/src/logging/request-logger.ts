import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * Express middleware that logs: method, path (url), status code, and duration (responseTime).
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    logger.info(
      {
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: res.statusCode,
        responseTime,
      },
      'request completed',
    );
  });

  next();
};
