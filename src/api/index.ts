import express from 'express';
import cors from 'cors';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';
import { apiKeyAuth, requestLogger, errorHandler } from './middleware/auth.js';
import projectsRouter from './routes/projects.js';
import healthRouter from './routes/health.js';

const logger = createChildLogger('api');

export function createServer() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Health endpoints (no auth required)
  app.use('/api/health', healthRouter);

  // API key authentication for other routes
  app.use('/api', apiKeyAuth);

  // API routes
  app.use('/api/projects', projectsRouter);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'PocketBase Multi-Project Server',
      version: '1.0.0',
      docs: '/api/docs',
      health: '/api/health',
    });
  });

  // API documentation endpoint
  app.get('/api/docs', (req, res) => {
    res.json({
      endpoints: {
        'GET /api/health': 'Health check',
        'GET /api/health/ready': 'Readiness probe',
        'GET /api/health/live': 'Liveness probe',
        'GET /api/projects': 'List all projects',
        'GET /api/projects/stats': 'Get statistics',
        'POST /api/projects': 'Create a new project',
        'GET /api/projects/:id': 'Get project by ID or slug',
        'PATCH /api/projects/:id': 'Update project',
        'DELETE /api/projects/:id': 'Delete project',
        'POST /api/projects/:id/start': 'Start project',
        'POST /api/projects/:id/stop': 'Stop project',
        'POST /api/projects/:id/restart': 'Restart project',
        'GET /api/projects/:id/logs': 'Get project logs',
        'GET /api/projects/:id/backups': 'List backups',
        'POST /api/projects/:id/backups': 'Create backup',
        'POST /api/projects/:id/backups/:filename/restore': 'Restore backup',
      },
      authentication: {
        header: 'x-api-key',
        description: 'API key required for all /api/* endpoints except health checks',
      },
    });
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  const app = createServer();

  return new Promise<void>((resolve) => {
    app.listen(config.port, config.host, () => {
      logger.info(`Server running at http://${config.host}:${config.port}`);
      logger.info(`API documentation at http://${config.host}:${config.port}/api/docs`);
      resolve();
    });
  });
}

