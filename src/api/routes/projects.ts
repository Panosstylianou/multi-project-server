import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { projectManager } from '../../services/project-manager.js';
import { credentialsManager } from '../../services/credentials-manager.js';
import { createChildLogger } from '../../utils/logger.js';
import type { ProjectStatus } from '../../types/index.js';

const logger = createChildLogger('api-projects');
const router = Router();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(30).optional(),
  description: z.string().max(500).optional(),
  clientName: z.string().max(100).optional(),
  clientEmail: z.string().email().optional(),
  config: z.object({
    memoryLimit: z.string().optional(),
    cpuLimit: z.string().optional(),
    autoBackup: z.boolean().optional(),
    backupSchedule: z.string().optional(),
    customDomain: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  clientName: z.string().max(100).optional(),
  clientEmail: z.string().email().optional(),
  config: z.object({
    memoryLimit: z.string().optional(),
    cpuLimit: z.string().optional(),
    autoBackup: z.boolean().optional(),
    backupSchedule: z.string().optional(),
    customDomain: z.string().optional(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Helper to wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * GET /api/projects
 * List all projects with optional filtering
 */
router.get('/', asyncHandler(async (req, res) => {
  const { status, clientName, search, limit, offset } = req.query;

  const projects = await projectManager.listProjects({
    status: status as ProjectStatus | undefined,
    clientName: clientName as string | undefined,
    search: search as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
  });

  res.json({
    success: true,
    data: projects,
    count: projects.length,
  });
}));

/**
 * GET /api/projects/stats
 * Get overall statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await projectManager.getStats();
  res.json({
    success: true,
    data: stats,
  });
}));

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', asyncHandler(async (req, res) => {
  const input = createProjectSchema.parse(req.body);
  const project = await projectManager.createProject(input);

  const url = await projectManager.getProjectUrl(project.id);
  const adminUrl = await projectManager.getProjectAdminUrl(project.id);

  logger.info(`Project created via API: ${project.slug}`);

  res.status(201).json({
    success: true,
    data: project,
    urls: {
      api: url,
      admin: adminUrl,
    },
    message: `Project "${project.name}" created successfully`,
  });
}));

/**
 * GET /api/projects/:id
 * Get project by ID or slug
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  let project = await projectManager.getProject(id);
  if (!project) {
    project = await projectManager.getProjectBySlug(id);
  }

  if (!project) {
    res.status(404).json({
      success: false,
      error: 'Project not found',
    });
    return;
  }

  const url = await projectManager.getProjectUrl(project.id);
  const adminUrl = await projectManager.getProjectAdminUrl(project.id);

  res.json({
    success: true,
    data: project,
    urls: {
      api: url,
      admin: adminUrl,
    },
  });
}));

/**
 * PATCH /api/projects/:id
 * Update project
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const input = updateProjectSchema.parse(req.body);

  const project = await projectManager.updateProject(id, input);

  res.json({
    success: true,
    data: project,
    message: 'Project updated successfully',
  });
}));

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { keepData } = req.query;

  await projectManager.deleteProject(id, keepData === 'true');

  res.json({
    success: true,
    message: 'Project deleted successfully',
  });
}));

/**
 * POST /api/projects/:id/start
 * Start project
 */
router.post('/:id/start', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.startProject(id);

  res.json({
    success: true,
    data: project,
    message: 'Project started successfully',
  });
}));

/**
 * POST /api/projects/:id/stop
 * Stop project
 */
router.post('/:id/stop', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.stopProject(id);

  res.json({
    success: true,
    data: project,
    message: 'Project stopped successfully',
  });
}));

/**
 * POST /api/projects/:id/restart
 * Restart project
 */
router.post('/:id/restart', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.restartProject(id);

  res.json({
    success: true,
    data: project,
    message: 'Project restarted successfully',
  });
}));

/**
 * GET /api/projects/:id/logs
 * Get project logs
 */
router.get('/:id/logs', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { tail } = req.query;

  const logs = await projectManager.getProjectLogs(id, tail ? parseInt(tail as string) : 100);

  res.json({
    success: true,
    data: { logs },
  });
}));

/**
 * GET /api/projects/:id/backups
 * List project backups
 */
router.get('/:id/backups', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const backups = await projectManager.listBackups(id);

  res.json({
    success: true,
    data: backups,
  });
}));

/**
 * POST /api/projects/:id/backups
 * Create project backup
 */
router.post('/:id/backups', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const backup = await projectManager.createBackup(id);

  res.status(201).json({
    success: true,
    data: backup,
    message: 'Backup created successfully',
  });
}));

/**
 * POST /api/projects/:id/backups/:filename/restore
 * Restore project from backup
 */
router.post('/:id/backups/:filename/restore', asyncHandler(async (req, res) => {
  const { id, filename } = req.params;
  await projectManager.restoreBackup(id, filename);

  res.json({
    success: true,
    message: 'Backup restored successfully',
  });
}));

/**
 * GET /api/projects/:id/test-connection
 * Test connection to project's PocketBase instance (server-side to avoid CORS)
 */
router.get('/:id/test-connection', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.getProject(id);

  if (!project) {
    res.status(404).json({
      success: false,
      error: 'Project not found',
    });
    return;
  }

  try {
    // Test connection to the PocketBase health endpoint
    const healthUrl = `https://${project.domain}/api/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      res.json({
        success: true,
        data: {
          status: 'connected',
          statusCode: response.status,
          message: 'Database is reachable and responding',
          healthData: data,
        },
      });
    } else {
      res.json({
        success: false,
        data: {
          status: 'error',
          statusCode: response.status,
          message: `Database returned status ${response.status}`,
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Connection test failed for project ${id}:`, errorMessage);

    res.json({
      success: false,
      data: {
        status: 'unreachable',
        message: 'Unable to reach database. It may not be running or the domain is not configured.',
        error: errorMessage,
      },
    });
  }
}));

/**
 * GET /api/projects/:id/credentials
 * Get stored credentials for a project
 */
router.get('/:id/credentials', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.getProject(id);

  if (!project) {
    res.status(404).json({
      success: false,
      error: 'Project not found',
    });
    return;
  }

  const credentials = credentialsManager.getCredentials(id);

  if (!credentials) {
    res.status(404).json({
      success: false,
      error: 'No credentials found for this project',
      message: 'Admin user may not have been created yet. Create one manually or recreate the database.',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      email: credentials.adminEmail,
      // Don't send password in API by default for security
      // User can view it in the dashboard details modal
      hasPassword: true,
      adminUrl: `https://${credentials.domain}/_/`,
      createdAt: credentials.createdAt,
    },
  });
}));

/**
 * GET /api/projects/:id/auto-login-url
 * Generate a URL to auto-login to PocketBase admin
 */
router.get('/:id/auto-login-url', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await projectManager.getProject(id);

  if (!project) {
    res.status(404).json({
      success: false,
      error: 'Project not found',
    });
    return;
  }

  const credentials = credentialsManager.getCredentials(id);

  if (!credentials) {
    res.status(404).json({
      success: false,
      error: 'No credentials found for this project',
    });
    return;
  }

  // For now, we'll authenticate via PocketBase API to get a token
  // Then construct a URL that will auto-login
  try {
    const authResponse = await fetch(`https://${project.domain}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity: credentials.adminEmail,
        password: credentials.adminPassword,
      }),
    });

    if (!authResponse.ok) {
      res.json({
        success: false,
        error: 'Failed to authenticate with PocketBase',
        message: 'Admin user may not exist or credentials are incorrect. Try logging in manually.',
        adminUrl: `https://${project.domain}/_/`,
      });
      return;
    }

    const authData = await authResponse.json() as { token: string; admin: Record<string, unknown> };
    const token = authData.token;

    // PocketBase admin uses the token in localStorage
    // We'll return a URL with the token as a query param and use JS to set it
    const autoLoginUrl = `https://${project.domain}/_/#/auto-login?token=${token}`;

    res.json({
      success: true,
      data: {
        autoLoginUrl,
        adminUrl: `https://${project.domain}/_/`,
        token, // Include token so dashboard can set it via postMessage or redirect
        expiresIn: '7 days', // PocketBase default token expiry
      },
    });
  } catch (error) {
    logger.warn(`Failed to generate auto-login URL for ${id}:`, error);
    
    res.json({
      success: false,
      error: 'Failed to generate auto-login URL',
      message: 'You can login manually with your credentials',
      adminUrl: `https://${project.domain}/_/`,
    });
  }
}));

export default router;

