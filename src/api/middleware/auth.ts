import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../utils/logger.js';
import { authService } from '../../services/auth-service.js';

const logger = createChildLogger('auth-middleware');

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

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
 * API Key authentication middleware for write operations only
 * GET requests are public, write operations (POST, PUT, PATCH, DELETE) require auth
 * This allows the dashboard to read data without embedding API keys
 */
export function apiKeyAuthWriteOnly(req: Request, res: Response, next: NextFunction): void {
  // Allow GET requests without authentication (for dashboard)
  if (req.method === 'GET') {
    next();
    return;
  }

  // Require auth for write operations
  apiKeyAuth(req, res, next);
}

/**
 * JWT Authentication middleware
 * Validates Bearer token in Authorization header
 * Used for dashboard and web UI authentication
 */
export function jwtAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide a valid Bearer token',
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      message: 'Please log in again',
    });
    return;
  }

  // Attach user info to request
  req.user = {
    userId: payload.userId,
    email: payload.email,
  };

  next();
}

/**
 * Combined authentication middleware
 * Accepts either JWT token (Bearer) or API key (x-api-key)
 * For write operations, at least one must be valid
 */
export function combinedAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow GET requests without authentication
  if (req.method === 'GET') {
    next();
    return;
  }

  // Check for JWT token first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = authService.verifyToken(token);
    
    if (payload) {
      req.user = {
        userId: payload.userId,
        email: payload.email,
      };
      next();
      return;
    }
  }

  // Fall back to API key auth
  const apiKey = req.headers['x-api-key'] as string;
  
  if (apiKey && apiKey === config.apiKey) {
    next();
    return;
  }

  // Neither auth method succeeded
  logger.warn(`Unauthorized write attempt from ${req.ip}`);
  res.status(401).json({
    success: false,
    error: 'Authentication required',
    message: 'Please provide a valid Bearer token or x-api-key header',
  });
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
  _next: NextFunction
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

