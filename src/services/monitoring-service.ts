import os from 'os';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { dockerManager } from './docker-manager.js';
import { storageManager } from './storage-manager.js';
import { createChildLogger } from '../utils/logger.js';
import type {
  SystemMetrics,
  ContainerMetrics,
  BackupStatus,
  MonitoringData,
  Alert,
  Project,
} from '../types/index.js';

const execAsync = promisify(exec);
const logger = createChildLogger('monitoring');

class MonitoringService {
  private alerts: Alert[] = [];
  private alertIdCounter = 0;

  async getSystemMetrics(): Promise<SystemMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    const cpuUsage = await this.calculateCpuUsage();

    // Get disk usage
    const diskUsage = await this.getDiskUsage();

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
      },
      memory: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: Math.round((usedMemory / totalMemory) * 100),
      },
      disk: diskUsage,
      uptime: os.uptime(),
      nodeVersion: process.version,
      platform: `${os.type()} ${os.release()}`,
    };
  }

  private async calculateCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    const startMeasure = cpus.map((cpu) => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((a, b) => a + b, 0),
    }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    const endCpus = os.cpus();
    const endMeasure = endCpus.map((cpu) => ({
      idle: cpu.times.idle,
      total: Object.values(cpu.times).reduce((a, b) => a + b, 0),
    }));

    let totalUsage = 0;
    for (let i = 0; i < startMeasure.length; i++) {
      const idleDiff = endMeasure[i].idle - startMeasure[i].idle;
      const totalDiff = endMeasure[i].total - startMeasure[i].total;
      const usage = totalDiff === 0 ? 0 : 100 - (idleDiff / totalDiff) * 100;
      totalUsage += usage;
    }

    return Math.round(totalUsage / startMeasure.length);
  }

  private async getDiskUsage(): Promise<{
    total: string;
    used: string;
    free: string;
    usagePercent: number;
  }> {
    try {
      // Try df command for Linux/macOS
      const { stdout } = await execAsync('df -k / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      
      // df output: Filesystem 1K-blocks Used Available Use% Mounted
      const total = parseInt(parts[1]) * 1024;
      const used = parseInt(parts[2]) * 1024;
      const free = parseInt(parts[3]) * 1024;
      const usagePercent = parseInt(parts[4].replace('%', ''));

      return {
        total: formatBytes(total),
        used: formatBytes(used),
        free: formatBytes(free),
        usagePercent,
      };
    } catch {
      // Fallback for Windows or if df fails
      return {
        total: 'N/A',
        used: 'N/A',
        free: 'N/A',
        usagePercent: 0,
      };
    }
  }

  async getContainerMetrics(): Promise<ContainerMetrics[]> {
    const metrics: ContainerMetrics[] = [];
    const projects = await storageManager.getAllProjects();

    for (const project of projects) {
      if (project.status === 'deleted') continue;

      try {
        const containerInfo = await dockerManager.getContainerInfo(project.containerName);
        
        if (containerInfo) {
          metrics.push({
            projectId: project.id,
            projectName: project.name,
            projectSlug: project.slug,
            containerName: project.containerName,
            status: containerInfo.status,
            state: containerInfo.state,
            memoryUsage: containerInfo.memoryUsage || '0 B',
            memoryLimit: project.config.memoryLimit,
            memoryPercent: this.parseMemoryPercent(containerInfo.memoryUsage, project.config.memoryLimit),
            cpuUsage: containerInfo.cpuUsage || '0%',
            networkRx: 'N/A', // Would need additional Docker stats call
            networkTx: 'N/A',
            uptime: containerInfo.started ? this.formatUptime(containerInfo.started) : 'N/A',
            restartCount: 0, // Would need additional Docker inspect
            healthStatus: containerInfo.state === 'running' ? 'healthy' : 'unhealthy',
          });
        } else {
          // Container doesn't exist
          metrics.push({
            projectId: project.id,
            projectName: project.name,
            projectSlug: project.slug,
            containerName: project.containerName,
            status: 'not found',
            state: 'error',
            memoryUsage: '0 B',
            memoryLimit: project.config.memoryLimit,
            memoryPercent: 0,
            cpuUsage: '0%',
            networkRx: 'N/A',
            networkTx: 'N/A',
            uptime: 'N/A',
            restartCount: 0,
            healthStatus: 'unhealthy',
          });
        }
      } catch (error) {
        logger.warn(`Failed to get metrics for ${project.containerName}`, error);
        metrics.push({
          projectId: project.id,
          projectName: project.name,
          projectSlug: project.slug,
          containerName: project.containerName,
          status: 'error',
          state: 'error',
          memoryUsage: '0 B',
          memoryLimit: project.config.memoryLimit,
          memoryPercent: 0,
          cpuUsage: '0%',
          networkRx: 'N/A',
          networkTx: 'N/A',
          uptime: 'N/A',
          restartCount: 0,
          healthStatus: 'unhealthy',
        });
      }
    }

    return metrics;
  }

  async getBackupStatus(): Promise<BackupStatus[]> {
    const status: BackupStatus[] = [];
    const projects = await storageManager.getAllProjects();

    for (const project of projects) {
      if (project.status === 'deleted') continue;

      try {
        const backups = await storageManager.listBackups(project.id);
        const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

        status.push({
          projectId: project.id,
          projectSlug: project.slug,
          lastBackup: backups.length > 0 ? backups[0].createdAt : null,
          backupCount: backups.length,
          totalBackupSize: formatBytes(totalSize),
          oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
        });
      } catch (error) {
        logger.warn(`Failed to get backup status for ${project.slug}`, error);
        status.push({
          projectId: project.id,
          projectSlug: project.slug,
          lastBackup: null,
          backupCount: 0,
          totalBackupSize: '0 B',
          oldestBackup: null,
        });
      }
    }

    return status;
  }

  async getFullMonitoringData(): Promise<MonitoringData> {
    const [system, containers, backups] = await Promise.all([
      this.getSystemMetrics(),
      this.getContainerMetrics(),
      this.getBackupStatus(),
    ]);

    // Generate alerts based on metrics
    this.generateAlerts(system, containers, backups);

    return {
      timestamp: new Date(),
      system,
      containers,
      backups,
      alerts: this.alerts.filter((a) => !a.acknowledged),
    };
  }

  private generateAlerts(
    system: SystemMetrics,
    containers: ContainerMetrics[],
    backups: BackupStatus[]
  ): void {
    // Clear old auto-generated alerts
    this.alerts = this.alerts.filter((a) => a.acknowledged);

    // High CPU alert
    if (system.cpu.usage > 80) {
      this.addAlert('warning', `High CPU usage: ${system.cpu.usage}%`, 'system');
    }
    if (system.cpu.usage > 95) {
      this.addAlert('critical', `Critical CPU usage: ${system.cpu.usage}%`, 'system');
    }

    // High memory alert
    if (system.memory.usagePercent > 80) {
      this.addAlert('warning', `High memory usage: ${system.memory.usagePercent}%`, 'system');
    }
    if (system.memory.usagePercent > 95) {
      this.addAlert('critical', `Critical memory usage: ${system.memory.usagePercent}%`, 'system');
    }

    // Disk space alert
    if (system.disk.usagePercent > 80) {
      this.addAlert('warning', `High disk usage: ${system.disk.usagePercent}%`, 'system');
    }
    if (system.disk.usagePercent > 95) {
      this.addAlert('critical', `Critical disk usage: ${system.disk.usagePercent}%`, 'system');
    }

    // Container health alerts
    for (const container of containers) {
      if (container.healthStatus === 'unhealthy') {
        this.addAlert('error', `Container ${container.projectSlug} is unhealthy`, container.projectSlug);
      }
      if (container.memoryPercent > 90) {
        this.addAlert('warning', `Container ${container.projectSlug} memory at ${container.memoryPercent}%`, container.projectSlug);
      }
    }

    // Backup alerts
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const backup of backups) {
      if (!backup.lastBackup) {
        this.addAlert('warning', `No backups found for ${backup.projectSlug}`, backup.projectSlug);
      } else if (backup.lastBackup.getTime() < oneDayAgo) {
        this.addAlert('info', `Backup for ${backup.projectSlug} is older than 24 hours`, backup.projectSlug);
      }
    }
  }

  private addAlert(severity: Alert['severity'], message: string, source: string): void {
    this.alerts.push({
      id: `alert-${++this.alertIdCounter}`,
      severity,
      message,
      source,
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  getAllAlerts(): Alert[] {
    return this.alerts;
  }

  private parseMemoryPercent(usage: string | undefined, limit: string): number {
    if (!usage) return 0;
    
    const usageBytes = parseMemoryString(usage);
    const limitBytes = parseMemoryLimit(limit);
    
    if (limitBytes === 0) return 0;
    return Math.round((usageBytes / limitBytes) * 100);
  }

  private formatUptime(started: Date): string {
    const seconds = Math.floor((Date.now() - started.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseMemoryString(str: string): number {
  const match = str.match(/^([\d.]+)\s*([KMGT]?B?)$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  switch (unit) {
    case 'KB': return value * 1024;
    case 'MB': return value * 1024 * 1024;
    case 'GB': return value * 1024 * 1024 * 1024;
    case 'TB': return value * 1024 * 1024 * 1024 * 1024;
    default: return value;
  }
}

function parseMemoryLimit(limit: string): number {
  const match = limit.match(/^(\d+)([kmg]?)$/i);
  if (!match) return 256 * 1024 * 1024; // Default 256MB
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'k': return value * 1024;
    case 'm': return value * 1024 * 1024;
    case 'g': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

export const monitoringService = new MonitoringService();

