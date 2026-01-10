import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('auth-middleware');

/**
 * API Key authentication middleware
 * Validates the x-api-key header against the configured API key
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development if no API key is configured
  if (config.nodeEnv === 'development' && config.apiKey === 'dev-api-key') {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.warn(`Missing API key from ${req.ip}`);
    res.status(401).json({
      success: false,
      error: 'Missing API key',
      message: 'Please provide an x-api-key header',
    });
    return;
  }

  if (apiKey !== config.apiKey) {
    logger.warn(`Invalid API key from ${req.ip}`);
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error & { statusCode?: number; status?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || err.status || 500;

  logger.error({
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  });

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      details: JSON.parse(err.message),
    });
    return;
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
}

