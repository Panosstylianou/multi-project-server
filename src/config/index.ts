import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

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
  traefikDashboardEnabled: process.env.TRAEFIK_DASHBOARD_ENABLED,
  traefikDashboardPort: process.env.TRAEFIK_DASHBOARD_PORT,
  acmeEmail: process.env.ACME_EMAIL,
  defaultMemoryLimit: process.env.DEFAULT_MEMORY_LIMIT,
  defaultCpuLimit: process.env.DEFAULT_CPU_LIMIT,
};

export const config = configSchema.parse(rawConfig);

export const paths = {
  data: path.resolve(config.dataDir),
  backups: path.resolve(config.backupsDir),
  projectData: (projectId: string) => path.resolve(config.dataDir, 'projects', projectId),
  projectBackup: (projectId: string) => path.resolve(config.backupsDir, projectId),
};

export type Config = z.infer<typeof configSchema>;

