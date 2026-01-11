import pino from 'pino';
import { config } from '../config/index.js';

// Use pino.pino for ESM compatibility
const createLogger = pino.pino || pino;

export const logger = createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  transport:
    config.nodeEnv !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export const createChildLogger = (name: string) => logger.child({ module: name });
