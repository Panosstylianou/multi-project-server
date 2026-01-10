export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  status: ProjectStatus;
  containerName: string;
  port: number;
  domain?: string;
  createdAt: Date;
  updatedAt: Date;
  config: ProjectConfig;
  metadata?: Record<string, unknown>;
}

export type ProjectStatus = 'creating' | 'running' | 'stopped' | 'error' | 'deleted';

export interface ProjectConfig {
  memoryLimit: string;
  cpuLimit: string;
  autoBackup: boolean;
  backupSchedule?: string; // cron expression
  customDomain?: string;
  enabledFeatures: {
    auth: boolean;
    storage: boolean;
    realtime: boolean;
  };
}

export interface CreateProjectInput {
  name: string;
  slug?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  config?: Partial<ProjectConfig>;
  metadata?: Record<string, unknown>;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  config?: Partial<ProjectConfig>;
  metadata?: Record<string, unknown>;
}

export interface ProjectListOptions {
  status?: ProjectStatus;
  clientName?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ProjectStats {
  totalProjects: number;
  runningProjects: number;
  stoppedProjects: number;
  totalStorage: string;
  totalMemoryUsed: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  state: string;
  ports: Array<{ hostPort: number; containerPort: number }>;
  created: Date;
  started?: Date;
  memoryUsage?: string;
  cpuUsage?: string;
}

export interface BackupInfo {
  id: string;
  projectId: string;
  filename: string;
  size: number;
  createdAt: Date;
  s3Key?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  docker: boolean;
  storage: boolean;
  projects: {
    total: number;
    running: number;
    errored: number;
  };
}

