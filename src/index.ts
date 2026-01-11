import { startServer } from './api/index.js';
import { projectManager } from './services/project-manager.js';
import { authService } from './services/auth-service.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('Starting PocketBase Multi-Project Server...');

  try {
    // Initialize services
    await projectManager.initialize();
    await authService.initialize();

    // Start API server
    await startServer();

    logger.info('Server initialized successfully');
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

main();

