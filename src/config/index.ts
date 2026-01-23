import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3000),
  host: z.string().default('0.0.0.0'),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Docker
  dockerSocket: z.string().default('/var/run/docker.sock'),
  pocketbaseImage: z.string().default('ghcr.io/muchobien/pocketbase:latest'),
  pocketbaseNetwork: z.string().default('pocketbase-network'),

  // Storage
  dataDir: z.string().default('./data'),
  backupsDir: z.string().default('./backups'),

  // Domain
  baseDomain: z.string().default('localhost'),
  useHttps: z.coerce.boolean().default(false),

  // AWS
  awsRegion: z.string().default('us-east-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  s3BackupBucket: z.string().optional(),

  // Security
  apiKey: z.string().default('dev-api-key'),
  adminEmail: z.string().email().default('admin@localhost'),
  adminPassword: z.string().default('admin123'),

  // Traefik
  traefikDashboardEnabled: z.coerce.boolean().default(true),
  traefikDashboardPort: z.coerce.number().default(8080),
  acmeEmail: z.string().optional(),

  // Resource limits
  defaultMemoryLimit: z.string().default('256m'),
  defaultCpuLimit: z.string().default('0.5'),
});

const rawConfig = {
  port: process.env.PORT,
  host: process.env.HOST,
  nodeEnv: process.env.NODE_ENV,
  dockerSocket: process.env.DOCKER_SOCKET,
  pocketbaseImage: process.env.POCKETBASE_IMAGE,
  pocketbaseNetwork: process.env.POCKETBASE_NETWORK,
  dataDir: process.env.DATA_DIR,
  backupsDir: process.env.BACKUPS_DIR,
  baseDomain: process.env.BASE_DOMAIN,
  useHttps: process.env.USE_HTTPS,
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3BackupBucket: process.env.S3_BACKUP_BUCKET,
  apiKey: process.env.API_KEY,
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  traefikDashboardEnabled: process.env.TRAEFIK_DASHBOARD_ENABLED,
  traefikDashboardPort: process.env.TRAEFIK_DASHBOARD_PORT,
  acmeEmail: process.env.ACME_EMAIL,
  defaultMemoryLimit: process.env.DEFAULT_MEMORY_LIMIT,
  defaultCpuLimit: process.env.DEFAULT_CPU_LIMIT,
};

export const config = configSchema.parse(rawConfig);

// Helper to resolve data/backup paths
// In Docker, these will be absolute paths like /app/data
// For local development, use relative paths from project root
function resolveDataPath(configuredPath: string): string {
  // If it's an absolute path that looks like a Docker path (/app or /app/...),
  // and we're not in a Docker container (check if /app exists and is writable),
  // fall back to relative path for local development
  if (path.isAbsolute(configuredPath) && configuredPath.startsWith('/app')) {
    // Check if /app exists - if not, we're likely running locally
    try {
      if (!fs.existsSync('/app') || !fs.statSync('/app').isDirectory()) {
        // This is a Docker path but we're running locally - use relative path instead
        const relativePath = configuredPath.replace(/^\/app/, '.');
        return path.resolve(process.cwd(), relativePath);
      }
    } catch {
      // Can't access /app, assume we're running locally
      const relativePath = configuredPath.replace(/^\/app/, '.');
      return path.resolve(process.cwd(), relativePath);
    }
    // /app exists, we're likely in Docker - use the path as-is
    return configuredPath;
  }
  // For other absolute paths, use as-is
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  // Relative paths: resolve from project root
  return path.resolve(process.cwd(), configuredPath);
}

export const paths = {
  data: resolveDataPath(config.dataDir),
  backups: resolveDataPath(config.backupsDir),
  projectData: (projectId: string) => {
    const basePath = resolveDataPath(config.dataDir);
    return path.resolve(basePath, 'projects', projectId);
  },
  projectBackup: (projectId: string) => {
    const basePath = resolveDataPath(config.backupsDir);
    return path.resolve(basePath, projectId);
  },
};

export type Config = z.infer<typeof configSchema>;

