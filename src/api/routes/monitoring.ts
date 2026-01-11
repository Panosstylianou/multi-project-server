import { Router, Request, Response } from 'express';
import { monitoringService } from '../../services/monitoring-service.js';

const router = Router();

/**
 * GET /api/monitoring
 * Get full monitoring data (system, containers, backups, alerts)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await monitoringService.getFullMonitoringData();
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch monitoring data',
    });
  }
});

/**
 * GET /api/monitoring/system
 * Get system metrics only
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getSystemMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system metrics',
    });
  }
});

/**
 * GET /api/monitoring/containers
 * Get container metrics only
 */
router.get('/containers', async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getContainerMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch container metrics',
    });
  }
});

/**
 * GET /api/monitoring/backups
 * Get backup status for all projects
 */
router.get('/backups', async (req: Request, res: Response) => {
  try {
    const status = await monitoringService.getBackupStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backup status',
    });
  }
});

/**
 * GET /api/monitoring/alerts
 * Get all alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const alerts = monitoringService.getAllAlerts();
    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts',
    });
  }
});

/**
 * POST /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', async (req: Request, res: Response) => {
  try {
    const success = monitoringService.acknowledgeAlert(req.params.id);
    if (success) {
      res.json({
        success: true,
        message: 'Alert acknowledged',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
    });
  }
});

export default router;

