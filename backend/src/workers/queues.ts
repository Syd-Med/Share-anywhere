import { Queue } from 'bullmq';
import { config } from '../config';

function getRedisConnection() {
  if (config.redisUrl.startsWith('redis://') || config.redisUrl.startsWith('rediss://')) {
    try {
      const u = new URL(config.redisUrl);
      return {
        host: u.hostname,
        port: parseInt(u.port || '6379', 10),
        password: u.password ? decodeURIComponent(u.password) : undefined,
        username: u.username || undefined,
      };
    } catch {
      return { host: 'localhost', port: 6379 };
    }
  }
  return { host: 'localhost', port: 6379 };
}

const connection = getRedisConnection();

export const thumbnailQueue = new Queue('thumbnail', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 100,
  },
});
