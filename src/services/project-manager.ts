import { nanoid } from 'nanoid';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';
import { dockerManager } from './docker-manager.js';
import { storageManager } from './storage-manager.js';
import type {
  Project,
  ProjectStatus,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectConfig,
  ProjectListOptions,
  ProjectStats,
  BackupInfo,
} from '../types/index.js';

const logger = createChildLogger('project-manager');

export class ProjectManager {
  private defaultConfig: ProjectConfig = {
    memoryLimit: config.defaultMemoryLimit,
    cpuLimit: config.defaultCpuLimit,
    autoBackup: true,
    enabledFeatures: {
      auth: true,
      storage: true,
      realtime: true,
    },
  };

  async initialize(): Promise<void> {
    logger.info('Initializing project manager...');
    await dockerManager.initialize();
    await storageManager.initialize();

    // Sync project statuses with actual container states
    await this.syncProjectStatuses();

    logger.info('Project manager initialized');
  }

  private async syncProjectStatuses(): Promise<void> {
    const projects = await storageManager.getAllProjects();

    for (const project of projects) {
      if (project.status === 'deleted') continue;

      const containerInfo = await dockerManager.getContainerInfo(project.containerName);

      let newStatus: ProjectStatus;
      if (!containerInfo) {
        newStatus = 'error';
      } else if (containerInfo.state === 'running') {
        newStatus = 'running';
      } else {
        newStatus = 'stopped';
      }

      if (project.status !== newStatus) {
        logger.info(`Syncing project ${project.slug} status: ${project.status} -> ${newStatus}`);
        project.status = newStatus;
        project.updatedAt = new Date();
        await storageManager.saveProject(project);
      }
    }
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    logger.info(`Creating project: ${input.name}`);

    // Generate slug if not provided
    const slug = input.slug || this.generateSlug(input.name);

    // Check if slug already exists
    const existing = await storageManager.getProjectBySlug(slug);
    if (existing) {
      throw new Error(`Project with slug "${slug}" already exists`);
    }

    const projectId = nanoid(12);
    const projectConfig: ProjectConfig = {
      ...this.defaultConfig,
      ...input.config,
    };

    // Create project record
    const project: Project = {
      id: projectId,
      name: input.name,
      slug,
      description: input.description,
      clientName: input.clientName,
      clientEmail: input.clientEmail,
      status: 'creating',
      containerName: '', // Will be set after container creation
      port: 0, // Will be set after container creation
      domain: `${slug}.${config.baseDomain}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: projectConfig,
      metadata: input.metadata,
    };

    // Save initial project state
    await storageManager.saveProject(project);

    try {
      // Ensure PocketBase image is available
      await dockerManager.pullImage();

      // Create and start container
      const containerResult = await dockerManager.createContainer(
        projectId,
        slug,
        projectConfig
      );

      project.containerName = containerResult.containerName;
      project.port = containerResult.port;

      await dockerManager.startContainer(containerResult.containerName);

      project.status = 'running';
      project.updatedAt = new Date();

      await storageManager.saveProject(project);

      logger.info(`Project created successfully: ${slug} (${projectId})`);

      return project;
    } catch (error) {
      project.status = 'error';
      project.updatedAt = new Date();
      await storageManager.saveProject(project);

      logger.error(`Failed to create project: ${slug}`, error);
      throw error;
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    return storageManager.getProject(projectId);
  }

  async getProjectBySlug(slug: string): Promise<Project | null> {
    return storageManager.getProjectBySlug(slug);
  }

  async listProjects(options: ProjectListOptions = {}): Promise<Project[]> {
    let projects = await storageManager.getAllProjects();

    // Filter by status
    if (options.status) {
      projects = projects.filter((p) => p.status === options.status);
    }

    // Filter by client name
    if (options.clientName) {
      projects = projects.filter((p) =>
        p.clientName?.toLowerCase().includes(options.clientName!.toLowerCase())
      );
    }

    // Search by name/slug/description
    if (options.search) {
      const search = options.search.toLowerCase();
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.slug.toLowerCase().includes(search) ||
          p.description?.toLowerCase().includes(search)
      );
    }

    // Sort by creation date (newest first)
    projects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    if (options.offset) {
      projects = projects.slice(options.offset);
    }
    if (options.limit) {
      projects = projects.slice(0, options.limit);
    }

    return projects;
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<Project> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Update fields
    if (input.name) project.name = input.name;
    if (input.description !== undefined) project.description = input.description;
    if (input.clientName !== undefined) project.clientName = input.clientName;
    if (input.clientEmail !== undefined) project.clientEmail = input.clientEmail;
    if (input.metadata) project.metadata = { ...project.metadata, ...input.metadata };
    if (input.config) project.config = { ...project.config, ...input.config };

    project.updatedAt = new Date();

    await storageManager.saveProject(project);

    logger.info(`Project updated: ${project.slug}`);

    return project;
  }

  async deleteProject(projectId: string, keepData = false): Promise<void> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    logger.info(`Deleting project: ${project.slug}`);

    // Remove container
    try {
      await dockerManager.removeContainer(project.containerName);
    } catch (error) {
      logger.warn(`Failed to remove container: ${project.containerName}`, error);
    }

    // Update status
    project.status = 'deleted';
    project.updatedAt = new Date();

    if (keepData) {
      await storageManager.saveProject(project);
    } else {
      await storageManager.deleteProject(projectId);
    }

    logger.info(`Project deleted: ${project.slug}`);
  }

  async startProject(projectId: string): Promise<Project> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.status === 'running') {
      return project;
    }

    await dockerManager.startContainer(project.containerName);

    project.status = 'running';
    project.updatedAt = new Date();
    await storageManager.saveProject(project);

    logger.info(`Project started: ${project.slug}`);

    return project;
  }

  async stopProject(projectId: string): Promise<Project> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.status === 'stopped') {
      return project;
    }

    await dockerManager.stopContainer(project.containerName);

    project.status = 'stopped';
    project.updatedAt = new Date();
    await storageManager.saveProject(project);

    logger.info(`Project stopped: ${project.slug}`);

    return project;
  }

  async restartProject(projectId: string): Promise<Project> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    await dockerManager.restartContainer(project.containerName);

    project.status = 'running';
    project.updatedAt = new Date();
    await storageManager.saveProject(project);

    logger.info(`Project restarted: ${project.slug}`);

    return project;
  }

  async getProjectLogs(projectId: string, tail = 100): Promise<string> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    return dockerManager.getContainerLogs(project.containerName, tail);
  }

  async createBackup(projectId: string): Promise<BackupInfo> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Stop container before backup for consistency
    const wasRunning = project.status === 'running';
    if (wasRunning) {
      await this.stopProject(projectId);
    }

    try {
      const backup = await storageManager.createBackup(project);
      return backup;
    } finally {
      if (wasRunning) {
        await this.startProject(projectId);
      }
    }
  }

  async listBackups(projectId: string): Promise<BackupInfo[]> {
    return storageManager.listBackups(projectId);
  }

  async restoreBackup(projectId: string, backupFilename: string): Promise<void> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Stop container before restore
    const wasRunning = project.status === 'running';
    if (wasRunning) {
      await this.stopProject(projectId);
    }

    try {
      await storageManager.restoreBackup(projectId, backupFilename);
    } finally {
      if (wasRunning) {
        await this.startProject(projectId);
      }
    }

    logger.info(`Backup restored for project: ${project.slug}`);
  }

  async getStats(): Promise<ProjectStats> {
    const projects = await storageManager.getAllProjects();
    const storageStats = await storageManager.getStorageStats();

    const runningProjects = projects.filter((p) => p.status === 'running').length;
    const stoppedProjects = projects.filter((p) => p.status === 'stopped').length;

    return {
      totalProjects: projects.length,
      runningProjects,
      stoppedProjects,
      totalStorage: formatBytes(storageStats.totalSize),
      totalMemoryUsed: 'N/A', // Would need to aggregate from Docker stats
    };
  }

  async getProjectUrl(projectId: string): Promise<string> {
    const project = await storageManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const protocol = config.useHttps ? 'https' : 'http';

    // If using a custom domain, return that
    if (project.domain && config.baseDomain !== 'localhost') {
      return `${protocol}://${project.domain}`;
    }

    // Otherwise return localhost with port
    return `http://localhost:${project.port}`;
  }

  async getProjectAdminUrl(projectId: string): Promise<string> {
    const baseUrl = await this.getProjectUrl(projectId);
    return `${baseUrl}/_/`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const projectManager = new ProjectManager();

