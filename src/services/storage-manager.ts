import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { config, paths } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';
import type { BackupInfo, Project } from '../types/index.js';

const logger = createChildLogger('storage-manager');

interface ProjectMetadata {
  projects: Record<string, Project>;
  lastUpdated: string;
}

export class StorageManager {
  private metadataPath: string;
  private metadata: ProjectMetadata;

  constructor() {
    this.metadataPath = path.join(paths.data, 'metadata.json');
    this.metadata = { projects: {}, lastUpdated: new Date().toISOString() };
  }

  async initialize(): Promise<void> {
    logger.info('Initializing storage manager...');

    // Ensure directories exist
    await fs.mkdir(paths.data, { recursive: true });
    await fs.mkdir(paths.backups, { recursive: true });
    await fs.mkdir(path.join(paths.data, 'projects'), { recursive: true });

    // Load existing metadata
    await this.loadMetadata();

    logger.info('Storage manager initialized');
  }

  private async loadMetadata(): Promise<void> {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      this.metadata = JSON.parse(data);
      logger.debug(`Loaded ${Object.keys(this.metadata.projects).length} projects from metadata`);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.info('No existing metadata found, creating new');
        await this.saveMetadata();
      } else {
        throw error;
      }
    }
  }

  private async saveMetadata(): Promise<void> {
    this.metadata.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }

  async saveProject(project: Project): Promise<void> {
    this.metadata.projects[project.id] = {
      ...project,
      createdAt: project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt),
      updatedAt: project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt),
    };
    await this.saveMetadata();
    logger.debug(`Saved project: ${project.id}`);
  }

  async getProject(projectId: string): Promise<Project | null> {
    const project = this.metadata.projects[projectId];
    if (!project) return null;

    return {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
    };
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    const project = Object.values(this.metadata.projects).find((p) => p.slug === slug);
    if (!project) return null;

    return {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt),
    };
  }

  async getAllProjects(): Promise<Project[]> {
    return Object.values(this.metadata.projects).map((p) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    }));
  }

  async deleteProject(projectId: string): Promise<void> {
    delete this.metadata.projects[projectId];
    await this.saveMetadata();

    // Remove project data directory
    const projectPath = paths.projectData(projectId);
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
      logger.info(`Deleted project data: ${projectPath}`);
    } catch (error) {
      logger.warn(`Failed to delete project data: ${projectPath}`, error);
    }
  }

  async createBackup(project: Project): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = paths.projectBackup(project.id);
    const filename = `${project.slug}-${timestamp}.tar.gz`;
    const backupPath = path.join(backupDir, filename);

    await fs.mkdir(backupDir, { recursive: true });

    const projectDataPath = paths.projectData(project.id);
    
    // Create tar.gz backup
    await this.createTarGz(projectDataPath, backupPath);

    const stats = await fs.stat(backupPath);

    const backupInfo: BackupInfo = {
      id: `backup-${Date.now()}`,
      projectId: project.id,
      filename,
      size: stats.size,
      createdAt: new Date(),
    };

    logger.info(`Created backup: ${filename} (${formatBytes(stats.size)})`);

    return backupInfo;
  }

  async listBackups(projectId: string): Promise<BackupInfo[]> {
    const backupDir = paths.projectBackup(projectId);

    try {
      const files = await fs.readdir(backupDir);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.tar.gz')) {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          backups.push({
            id: file.replace('.tar.gz', ''),
            projectId,
            filename: file,
            size: stats.size,
            createdAt: stats.mtime,
          });
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch {
      return [];
    }
  }

  async restoreBackup(projectId: string, backupFilename: string): Promise<void> {
    const backupPath = path.join(paths.projectBackup(projectId), backupFilename);
    const projectDataPath = paths.projectData(projectId);

    // Verify backup exists
    await fs.access(backupPath);

    // Clear existing data
    await fs.rm(projectDataPath, { recursive: true, force: true });
    await fs.mkdir(projectDataPath, { recursive: true });

    // Extract backup
    await this.extractTarGz(backupPath, projectDataPath);

    logger.info(`Restored backup: ${backupFilename} to ${projectDataPath}`);
  }

  async deleteBackup(projectId: string, backupFilename: string): Promise<void> {
    const backupPath = path.join(paths.projectBackup(projectId), backupFilename);
    await fs.unlink(backupPath);
    logger.info(`Deleted backup: ${backupFilename}`);
  }

  async getStorageStats(): Promise<{ totalSize: number; projectSizes: Record<string, number> }> {
    const projectSizes: Record<string, number> = {};
    let totalSize = 0;

    const projectsDir = path.join(paths.data, 'projects');

    try {
      const projects = await fs.readdir(projectsDir);

      for (const projectId of projects) {
        const projectPath = path.join(projectsDir, projectId);
        const size = await this.getDirectorySize(projectPath);
        projectSizes[projectId] = size;
        totalSize += size;
      }
    } catch {
      // Directory might not exist yet
    }

    return { totalSize, projectSizes };
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          size += await this.getDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          size += stats.size;
        }
      }
    } catch {
      // Directory might not be readable
    }

    return size;
  }

  private async createTarGz(sourceDir: string, destPath: string): Promise<void> {
    // Simple implementation using Node.js streams
    // For production, consider using archiver or tar packages
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const parentDir = path.dirname(sourceDir);
    const dirName = path.basename(sourceDir);

    await execAsync(`tar -czf "${destPath}" -C "${parentDir}" "${dirName}"`);
  }

  private async extractTarGz(archivePath: string, destDir: string): Promise<void> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    await execAsync(`tar -xzf "${archivePath}" -C "${destDir}" --strip-components=1`);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const storageManager = new StorageManager();

