// PocketBase Manager API - v1.1.0
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';
import { apiKeyAuthWriteOnly, requestLogger, errorHandler } from './middleware/auth.js';
import projectsRouter from './routes/projects.js';
import healthRouter from './routes/health.js';
import monitoringRouter from './routes/monitoring.js';

const logger = createChildLogger('api');

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Serve static dashboard files
  const dashboardPath = path.join(__dirname, '../../dashboard');
  app.use('/dashboard', express.static(dashboardPath));

  // Redirect root to dashboard
  app.get('/', (req, res) => {
    res.redirect('/dashboard');
  });

  // Public endpoints (no auth required)
  app.use('/api/health', healthRouter);
  app.use('/api/monitoring', monitoringRouter);

  // Projects API (GET is public for dashboard, write operations require auth)
  app.use('/api/projects', apiKeyAuthWriteOnly, projectsRouter);

  // API documentation endpoint (public)
  app.get('/api/docs', (req, res) => {
    res.json({
      endpoints: {
        // Health
        'GET /api/health': 'Health check',
        'GET /api/health/ready': 'Readiness probe',
        'GET /api/health/live': 'Liveness probe',
        // Monitoring
        'GET /api/monitoring': 'Full monitoring data',
        'GET /api/monitoring/system': 'System metrics',
        'GET /api/monitoring/containers': 'Container metrics',
        'GET /api/monitoring/backups': 'Backup status',
        'GET /api/monitoring/alerts': 'All alerts',
        'POST /api/monitoring/alerts/:id/acknowledge': 'Acknowledge alert',
        // Projects
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
        description: 'API key required for write operations (POST, PUT, PATCH, DELETE). GET requests are public for dashboard access.',
      },
      dashboard: {
        url: '/dashboard',
        description: 'Web dashboard for monitoring and management',
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
      logger.info(`Dashboard available at http://${config.host}:${config.port}/dashboard`);
      logger.info(`API documentation at http://${config.host}:${config.port}/api/docs`);
      resolve();
    });
  });
}
